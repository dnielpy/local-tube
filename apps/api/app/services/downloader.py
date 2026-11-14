import errno
import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yt_dlp
from yt_dlp.extractor.youtube import YoutubeIE
from yt_dlp.postprocessor import PostProcessor

ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*m")

# Errors that a new attempt cannot fix. Anything else (timeouts, resets, 5xx, a 403 from an
# expired stream URL...) is worth retrying on a weak connection.
PERMANENT_ERRORS = (
    "private video",
    "video unavailable",
    "this video is unavailable",
    "has been removed",
    "has been terminated",
    "copyright",
    "members-only",
    "join this channel",
    "confirm your age",
    "inappropriate for some users",
    "sign in to confirm",
    "cookies are no longer valid",
    "unsupported url",
    "is not a valid url",
    "only single videos are supported",
    "no space left on device",
    "premieres in",
    "this live event will begin",
)

# Patient enough for a slow link, but a connection that stops sending is still noticed.
SOCKET_TIMEOUT = 60
HTTP_CHUNK_SIZE = 10 * 1024 * 1024


def _backoff(attempt: int) -> float:
    return min(2**attempt, 60)


def resilient_options() -> dict[str, Any]:
    """Retry and resume settings for a connection that is slow and drops often."""
    return {
        "socket_timeout": SOCKET_TIMEOUT,
        "retries": 50,
        "fragment_retries": 50,
        "extractor_retries": 10,
        "file_access_retries": 10,
        "retry_sleep_functions": {"http": _backoff, "fragment": _backoff, "extractor": _backoff},
        # Keep the .part files and continue them with a Range request.
        "continuedl": True,
        "nopart": False,
        # A missing fragment must fail and be retried, not leave a hole in the video.
        "skip_unavailable_fragments": False,
        "http_chunk_size": HTTP_CHUNK_SIZE,
    }


def format_selector(max_height: int | None) -> str:
    cap = f"[height<={max_height}]" if max_height else ""
    return f"bv*{cap}[ext=mp4][vcodec^=avc]+ba[ext=m4a]/b{cap}[ext=mp4]/bv*{cap}+ba/b{cap}/b"


@dataclass
class Progress:
    status: str
    percent: float | None = None
    speed: float | None = None
    eta: int | None = None
    total_bytes: int | None = None
    format_id: str | None = None


@dataclass
class Probe:
    youtube_id: str
    title: str | None
    info: dict[str, Any]


@dataclass
class DownloadResult:
    youtube_id: str
    title: str
    description: str
    channel: str | None
    channel_id: str | None
    duration_seconds: int | None
    youtube_url: str
    file_path: str
    thumbnail_path: str | None
    file_size: int | None


@dataclass
class Quality:
    height: int
    size_bytes: int | None


@dataclass
class VideoFormats:
    youtube_id: str
    title: str
    channel: str | None
    duration_seconds: int | None
    qualities: list[Quality]


def _size(fmt: dict[str, Any]) -> int | None:
    size = fmt.get("filesize") or fmt.get("filesize_approx")
    return int(size) if size else None


def available_qualities(formats: list[dict[str, Any]]) -> list[Quality]:
    heights = sorted(
        {
            int(f["height"])
            for f in formats
            if f.get("height") and f["height"] >= 144 and f.get("vcodec") not in (None, "none")
        }
    )
    context = {
        "formats": formats,
        "has_merged_format": any("none" not in (f.get("acodec"), f.get("vcodec")) for f in formats),
        "incomplete_formats": False,
    }
    qualities: dict[int, Quality] = {}
    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True}) as ydl:
        for height in heights:
            selector = ydl.build_format_selector(format_selector(height))
            chosen = next(iter(selector(dict(context))), None)
            if not chosen or not chosen.get("height"):
                continue
            parts = chosen.get("requested_formats") or [chosen]
            sizes = [_size(part) for part in parts]
            size = sum(sizes) if all(size is not None for size in sizes) else None
            actual = int(chosen["height"])
            qualities[actual] = Quality(height=actual, size_bytes=size)
    return [qualities[height] for height in sorted(qualities)]


class DownloadError(Exception):
    def __init__(self, message: str, transient: bool = False) -> None:
        super().__init__(message)
        self.transient = transient


def is_transient(exc: BaseException) -> bool:
    """Whether trying again later could make this error go away."""
    original = getattr(exc, "exc_info", None)
    cause = original[1] if original and len(original) > 1 else exc.__cause__
    for error in (exc, cause):
        if isinstance(error, OSError) and error.errno == errno.ENOSPC:
            return False
    message = clean_error(exc).lower()
    return not any(pattern in message for pattern in PERMANENT_ERRORS)


def _download_error(exc: Exception) -> DownloadError:
    return DownloadError(clean_error(exc), transient=is_transient(exc))


class DownloadCancelled(DownloadError):
    pass


def _never() -> bool:
    return False


def parse_youtube_id(url: str) -> str | None:
    if not YoutubeIE.suitable(url):
        return None
    return YoutubeIE.get_temp_id(url)


def base_options(cookies_file: str | None = None) -> dict[str, Any]:
    options: dict[str, Any] = {"quiet": True, "no_warnings": True, "noprogress": True}
    if cookies_file and Path(cookies_file).is_file():
        options["cookiefile"] = cookies_file
    return options


class YtDlpDownloader:
    def __init__(self, media_root: Path) -> None:
        self.media_root = media_root

    def _options(
        self,
        cookies_file: str | None = None,
        on_progress: Callable[[Progress], None] | None = None,
        max_height: int | None = None,
        should_cancel: Callable[[], bool] = _never,
        format_id: str | None = None,
        reporter: "_ProgressReporter | None" = None,
    ) -> dict[str, Any]:
        selector = format_selector(max_height)
        options: dict[str, Any] = {
            **base_options(cookies_file),
            **resilient_options(),
            "noplaylist": True,
            # A retry reuses the streams it already started, so their .part files continue.
            "format": f"{format_id}/{selector}" if format_id else selector,
            "merge_output_format": "mp4",
            "paths": {"home": str(self.media_root)},
            "outtmpl": {
                "default": "%(id)s/video.%(ext)s",
                "thumbnail": "%(id)s/thumbnail.%(ext)s",
            },
            "writethumbnail": True,
            "postprocessors": [
                {"key": "FFmpegThumbnailsConvertor", "format": "jpg", "when": "before_dl"}
            ],
        }
        if on_progress is not None:
            report = reporter or _ProgressReporter(on_progress)

            def progress_hook(d: dict[str, Any]) -> None:
                if should_cancel():
                    raise yt_dlp.utils.DownloadCancelled()
                report(d)

            def postprocessor_hook(d: dict[str, Any]) -> None:
                if should_cancel():
                    raise yt_dlp.utils.DownloadCancelled()
                if d["status"] == "started":
                    on_progress(Progress("processing"))

            options["progress_hooks"] = [progress_hook]
            options["postprocessor_hooks"] = [postprocessor_hook]
        return options

    def probe(self, url: str, cookies_file: str | None = None) -> Probe:
        try:
            with yt_dlp.YoutubeDL(self._options(cookies_file)) as ydl:
                info = ydl.extract_info(url, download=False, process=False)
        except yt_dlp.utils.YoutubeDLError as exc:
            raise _download_error(exc) from exc
        if info is None or info.get("_type", "video") not in ("video", "url"):
            raise DownloadError("Only single videos are supported, not playlists or channels")
        return Probe(youtube_id=info["id"], title=info.get("title"), info=info)

    def formats(self, url: str, cookies_file: str | None = None) -> VideoFormats:
        try:
            with yt_dlp.YoutubeDL({**base_options(cookies_file), "noplaylist": True}) as ydl:
                info = ydl.extract_info(url, download=False)
        except yt_dlp.utils.YoutubeDLError as exc:
            raise DownloadError(clean_error(exc)) from exc
        if info is None or info.get("_type", "video") != "video":
            raise DownloadError("Only single videos are supported, not playlists or channels")
        return VideoFormats(
            youtube_id=info["id"],
            title=info.get("title") or info["id"],
            channel=info.get("channel") or info.get("uploader"),
            duration_seconds=int(info["duration"]) if info.get("duration") else None,
            qualities=available_qualities(info.get("formats") or []),
        )

    def download(
        self,
        probe: Probe,
        on_progress: Callable[[Progress], None],
        max_height: int | None = None,
        should_cancel: Callable[[], bool] = _never,
        cookies_file: str | None = None,
        format_id: str | None = None,
    ) -> DownloadResult:
        reporter = _ProgressReporter(on_progress)
        options = self._options(
            cookies_file, on_progress, max_height, should_cancel, format_id, reporter
        )
        try:

            def selected(info: dict[str, Any]) -> None:
                finish_complete_parts(self.media_root / info["id"], info)
                reporter.selected(info)

            with yt_dlp.YoutubeDL(options) as ydl:
                # Added after the hooks, so it does not show up as "processing".
                ydl.add_post_processor(_SelectedFormat(selected), when="before_dl")
                info = ydl.process_ie_result(probe.info, download=True)
        except yt_dlp.utils.DownloadCancelled as exc:
            raise DownloadCancelled("Cancelled") from exc
        except (yt_dlp.utils.YoutubeDLError, OSError) as exc:
            if should_cancel():
                raise DownloadCancelled("Cancelled") from exc
            raise _download_error(exc) from exc

        downloads = info.get("requested_downloads") or []
        video_file = Path(downloads[0]["filepath"]) if downloads else None
        if video_file is None or not video_file.is_file() or video_file.stat().st_size == 0:
            # The parts are still on disk, so the next attempt only redoes the merge.
            raise DownloadError("The video file is missing after the download", transient=True)
        thumbnail = video_file.with_name("thumbnail.jpg")
        return DownloadResult(
            youtube_id=info["id"],
            title=info.get("title") or info["id"],
            description=info.get("description") or "",
            channel=info.get("channel") or info.get("uploader"),
            channel_id=info.get("channel_id"),
            duration_seconds=int(info["duration"]) if info.get("duration") else None,
            youtube_url=info.get("webpage_url") or probe.info.get("webpage_url") or "",
            file_path=str(video_file.relative_to(self.media_root.resolve())),
            thumbnail_path=(
                str(thumbnail.relative_to(self.media_root.resolve()))
                if thumbnail.is_file()
                else None
            ),
            file_size=video_file.stat().st_size,
        )


def finish_complete_parts(directory: Path, info: dict[str, Any]) -> None:
    """Rename .part files that already hold the whole stream.

    A download stopped right after its last byte leaves a full .part file. Resuming it asks
    YouTube for a range past the end, which fails with 416 on every attempt.
    """
    formats = info.get("requested_formats") or [info]
    for fmt in formats:
        size = fmt.get("filesize")
        if not size:
            continue
        tag = f".f{fmt['format_id']}" if len(formats) > 1 else ""
        for part in directory.glob(f"video{tag}.*.part"):
            final = part.with_suffix("")
            if part.stat().st_size == size and not final.exists():
                part.rename(final)


class _ProgressReporter:
    """Turns yt-dlp's per-stream progress into progress of the whole video."""

    def __init__(self, on_progress: Callable[[Progress], None]) -> None:
        self.on_progress = on_progress
        self.finished = 0
        self.parts = 1
        self.format_id: str | None = None
        self.total_bytes: int | None = None

    def selected(self, info: dict[str, Any]) -> None:
        # The streams of a merged format are downloaded one by one, and their progress no
        # longer carries the combined format id ("134+140"), so it is taken before they start.
        self.format_id = info.get("format_id")
        self.parts = len(info.get("requested_formats") or []) or 1
        self.total_bytes = _total_size(info)
        self.on_progress(Progress("downloading", format_id=self.format_id))

    def __call__(self, d: dict[str, Any]) -> None:
        if d["status"] == "finished":
            self.finished += 1
            self.on_progress(
                Progress(
                    "downloading",
                    percent=min(self.finished / self.parts, 1) * 100,
                    format_id=self.format_id,
                )
            )
            return
        if d["status"] != "downloading":
            return
        total = d.get("total_bytes") or d.get("total_bytes_estimate")
        fraction = d.get("downloaded_bytes", 0) / total if total else 0
        self.on_progress(
            Progress(
                "downloading",
                percent=min((self.finished + fraction) / self.parts, 1) * 100,
                speed=d.get("speed"),
                eta=d.get("eta"),
                total_bytes=self.total_bytes or (int(total) if total else None),
                format_id=self.format_id,
            )
        )


class _SelectedFormat(PostProcessor):
    def __init__(self, on_selected: Callable[[dict[str, Any]], None]) -> None:
        super().__init__()
        self.on_selected = on_selected

    def run(self, information: dict[str, Any]) -> tuple[list[str], dict[str, Any]]:
        self.on_selected(information)
        return [], information


def _total_size(info: dict[str, Any]) -> int | None:
    parts = info.get("requested_formats") or []
    sizes = [_size(part) for part in parts]
    if not sizes or any(size is None for size in sizes):
        return None
    return sum(size for size in sizes if size is not None)


def clean_error(exc: Exception) -> str:
    return ANSI_ESCAPE.sub("", str(exc)).strip().removeprefix("ERROR:").strip()
