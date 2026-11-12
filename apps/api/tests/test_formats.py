import pytest

from app.main import app
from app.routers.downloads import default_height, get_downloader
from app.services.connectivity import connectivity
from app.services.downloader import DownloadError, Quality, VideoFormats, available_qualities

URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

FORMATS = [
    {"format_id": "sb0", "vcodec": "none", "acodec": "none", "ext": "mhtml"},
    {"format_id": "251", "vcodec": "none", "acodec": "opus", "ext": "webm", "filesize": 4_000},
    {"format_id": "140", "vcodec": "none", "acodec": "mp4a", "ext": "m4a", "filesize": 3_000},
    {"format_id": "18", "vcodec": "avc1", "acodec": "mp4a", "ext": "mp4", "height": 360},
    {
        "format_id": "160",
        "vcodec": "avc1",
        "acodec": "none",
        "ext": "mp4",
        "height": 144,
        "filesize": 1_000,
    },
    {
        "format_id": "243",
        "vcodec": "vp9",
        "acodec": "none",
        "ext": "webm",
        "height": 360,
        "filesize": 8_000,
    },
    {
        "format_id": "134",
        "vcodec": "avc1",
        "acodec": "none",
        "ext": "mp4",
        "height": 360,
        "filesize": 10_000,
    },
    {
        "format_id": "247",
        "vcodec": "vp9",
        "acodec": "none",
        "ext": "webm",
        "height": 720,
        "filesize_approx": 50_000,
    },
    {"format_id": "137", "vcodec": "avc1", "acodec": "none", "ext": "mp4", "height": 1080},
]
for fmt in FORMATS:
    fmt["url"] = f"https://example.invalid/{fmt['format_id']}"


def test_available_qualities_match_what_would_be_downloaded():
    qualities = available_qualities(FORMATS)

    assert qualities == [
        Quality(height=144, size_bytes=4_000),
        Quality(height=360, size_bytes=13_000),
        Quality(height=1080, size_bytes=None),
    ]


@pytest.mark.parametrize(
    ("heights", "preferred", "expected"),
    [
        ([144, 360, 720], 360, 360),
        ([144, 240, 720], 360, 240),
        ([720, 1080], 360, 720),
        ([], 360, None),
    ],
)
def test_default_height(heights, preferred, expected):
    assert default_height([Quality(h, None) for h in heights], preferred) == expected


class FakeFormats:
    def __init__(self, error: str | None = None) -> None:
        self.error = error
        self.calls = 0

    def formats(self, url: str, cookies_file=None) -> VideoFormats:
        self.calls += 1
        if self.error:
            raise DownloadError(self.error)
        return VideoFormats(
            youtube_id="dQw4w9WgXcQ",
            title="Never Gonna Give You Up",
            channel="Rick Astley",
            duration_seconds=213,
            qualities=available_qualities(FORMATS),
        )


@pytest.fixture
def fake_formats():
    fake = FakeFormats()
    app.dependency_overrides[get_downloader] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_downloader, None)


async def test_formats_endpoint_lists_qualities_with_default(client, fake_formats):
    body = (await client.get("/api/downloads/formats", params={"url": URL})).json()

    assert body["title"] == "Never Gonna Give You Up"
    assert [q["height"] for q in body["qualities"]] == [144, 360, 1080]
    assert body["default_height"] == 360
    assert body["video_id"] is None


async def test_formats_endpoint_reports_video_already_downloaded(client, fake_formats, make_video):
    video = await make_video("dQw4w9WgXcQ")

    body = (await client.get("/api/downloads/formats", params={"url": URL})).json()

    assert body["video_id"] == str(video.id)


async def test_formats_endpoint_needs_connection(client, fake_formats):
    connectivity.forced_offline = True

    response = await client.get("/api/downloads/formats", params={"url": URL})

    assert response.status_code == 503
    assert fake_formats.calls == 0


async def test_formats_endpoint_reports_youtube_errors(client):
    app.dependency_overrides[get_downloader] = lambda: FakeFormats("Video unavailable")
    try:
        response = await client.get("/api/downloads/formats", params={"url": URL})
    finally:
        app.dependency_overrides.pop(get_downloader, None)

    assert response.status_code == 422
    assert response.json()["detail"] == "Video unavailable"
