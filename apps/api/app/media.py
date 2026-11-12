import shutil
from pathlib import Path

from app.config import get_settings


def media_path(relative: str) -> Path:
    root = get_settings().media_root.resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root):
        raise ValueError(f"path escapes media root: {relative}")
    return path


def remove_video_dir(youtube_id: str) -> None:
    directory = media_path(youtube_id)
    if directory != get_settings().media_root.resolve():
        shutil.rmtree(directory, ignore_errors=True)
