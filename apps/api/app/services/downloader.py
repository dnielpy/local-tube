import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yt_dlp
from yt_dlp.extractor.youtube import YoutubeIE

ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*m")


def format_selector(max_height: int | None) -> str:
    cap = f"[height<={max_height}]" if max_height else ""
    return f"bv*{cap}[ext=mp4][vcodec^=avc]+ba[ext=m4a]/b{cap}[ext=mp4]/bv*{cap}+ba/b{cap}/b"


@dataclass
class Progress:
    status: str
    percent: float | None = None
    speed: float | None = None
    eta: int | None = None


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
    pass


def parse_youtube_id(url: str) -> str | None:
    if not YoutubeIE.suitable(url):
        return None
    return YoutubeIE.get_temp_id(url)


def base_options(cookies_file: str | None, cookies_from_browser: str | None) -> dict[str, Any]:
    options: dict[str, Any] = {"quiet": True, "no_warnings": True, "noprogress": True}
    if cookies_file and Path(cookies_file).is_file():
        options["cookiefile"] = cookies_file
    elif cookies_from_browser:
        options["cookiesfrombrowser"] = (cookies_from_browser,)
    return options


class YtDlpDownloader:
    def __init__(
        self,
        media_root: Path,
        cookies_file: str | None = None,
        cookies_from_browser: str | None = None,
    ) -> None:
        self.media_root = media_root
        self.cookies_file = cookies_file
        self.cookies_from_browser = cookies_from_browser

    def _options(
        self,
        on_progress: Callable[[Progress], None] | None = None,
        max_height: int | None = None,
    ) -> dict[str, Any]:
        options: dict[str, Any] = {
            **base_options(self.cookies_file, self.cookies_from_browser),
            "noplaylist": True,
            "format": format_selector(max_height),
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
            options["progress_hooks"] = [_progress_hook(on_progress)]
            options["postprocessor_hooks"] = [
                lambda d: d["status"] == "started" and on_progress(Progress("processing"))
            ]
        return options

    def probe(self, url: str) -> Probe:
        try:
            with yt_dlp.YoutubeDL(self._options()) as ydl:
                info = ydl.extract_info(url, download=False, process=False)
        except yt_dlp.utils.YoutubeDLError as exc:
            raise DownloadError(clean_error(exc)) from exc
        if info is None or info.get("_type", "video") not in ("video", "url"):
            raise DownloadError("Only single videos are supported, not playlists or channels")
        return Probe(youtube_id=info["id"], title=info.get("title"), info=info)

    def formats(self, url: str) -> VideoFormats:
        try:
            with yt_dlp.YoutubeDL(
                {**base_options(self.cookies_file, self.cookies_from_browser), "noplaylist": True}
            ) as ydl:
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
    ) -> DownloadResult:
        try:
            with yt_dlp.YoutubeDL(self._options(on_progress, max_height)) as ydl:
                info = ydl.process_ie_result(probe.info, download=True)
        except yt_dlp.utils.YoutubeDLError as exc:
            raise DownloadError(clean_error(exc)) from exc

        video_file = Path(info["requested_downloads"][0]["filepath"])
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
            file_size=video_file.stat().st_size if video_file.is_file() else None,
        )


def _progress_hook(on_progress: Callable[[Progress], None]) -> Callable[[dict[str, Any]], None]:
    finished = 0

    def hook(d: dict[str, Any]) -> None:
        nonlocal finished
        parts = len(d.get("info_dict", {}).get("requested_formats") or []) or 1
        if d["status"] == "finished":
            finished += 1
            on_progress(Progress("downloading", percent=min(finished / parts, 1) * 100))
            return
        if d["status"] != "downloading":
            return
        total = d.get("total_bytes") or d.get("total_bytes_estimate")
        fraction = d.get("downloaded_bytes", 0) / total if total else 0
        on_progress(
            Progress(
                "downloading",
                percent=min((finished + fraction) / parts, 1) * 100,
                speed=d.get("speed"),
                eta=d.get("eta"),
            )
        )

    return hook


def clean_error(exc: Exception) -> str:
    return ANSI_ESCAPE.sub("", str(exc)).strip().removeprefix("ERROR:").strip()
