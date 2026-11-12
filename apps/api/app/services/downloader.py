"""Thin wrapper around yt-dlp. Everything here is blocking and runs in a worker thread."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yt_dlp
from yt_dlp.extractor.youtube import YoutubeIE

# Prefer H.264 + AAC in an mp4 so every browser can play the file without transcoding.
FORMAT = "bv*[ext=mp4][vcodec^=avc]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b"


@dataclass
class Progress:
    status: str  # "downloading" | "processing"
    percent: float | None = None
    speed: float | None = None  # bytes per second
    eta: int | None = None  # seconds


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
    duration_seconds: int | None
    youtube_url: str
    file_path: str  # relative to the media root
    thumbnail_path: str | None
    file_size: int | None


class DownloadError(Exception):
    pass


def parse_youtube_id(url: str) -> str | None:
    """Return the YouTube video id from a URL without hitting the network, if it is one."""
    if not YoutubeIE.suitable(url):
        return None
    return YoutubeIE.get_temp_id(url)


class YtDlpDownloader:
    def __init__(self, media_root: Path) -> None:
        self.media_root = media_root

    def _options(self, on_progress: Callable[[Progress], None] | None = None) -> dict[str, Any]:
        options: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "noplaylist": True,
            "format": FORMAT,
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
            raise DownloadError(_clean_error(exc)) from exc
        if info is None or info.get("_type", "video") not in ("video", "url"):
            raise DownloadError("Only single videos are supported, not playlists or channels")
        return Probe(youtube_id=info["id"], title=info.get("title"), info=info)

    def download(self, probe: Probe, on_progress: Callable[[Progress], None]) -> DownloadResult:
        try:
            with yt_dlp.YoutubeDL(self._options(on_progress)) as ydl:
                info = ydl.process_ie_result(probe.info, download=True)
        except yt_dlp.utils.YoutubeDLError as exc:
            raise DownloadError(_clean_error(exc)) from exc

        video_file = Path(info["requested_downloads"][0]["filepath"])
        thumbnail = video_file.with_name("thumbnail.jpg")
        return DownloadResult(
            youtube_id=info["id"],
            title=info.get("title") or info["id"],
            description=info.get("description") or "",
            channel=info.get("channel") or info.get("uploader"),
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
    # Video and audio are downloaded as separate files and then merged, so spread the
    # percentage across all requested formats instead of restarting at 0 for the audio.
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


def _clean_error(exc: Exception) -> str:
    return str(exc).removeprefix("ERROR: ").strip()
