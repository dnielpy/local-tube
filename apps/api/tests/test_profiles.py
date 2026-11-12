import uuid
from pathlib import Path

from app.db import SessionLocal
from app.models import Video
from app.services.connectivity import connectivity
from app.services.profiles import SESSION_COOKIE, cookies_path
from app.services.youtube_cookies import normalize
from tests.conftest import COOKIES


async def create(client, name="Ana", pin="1234", cookies=COOKIES):
    return await client.post("/api/profiles", json={"name": name, "pin": pin, "cookies": cookies})


async def test_endpoints_need_a_profile(anon_client):
    for path in ("/api/videos", "/api/downloads", "/api/channels", "/api/session"):
        assert (await anon_client.get(path)).status_code == 401
    assert (await anon_client.get("/api/status")).status_code == 200


async def test_picker_lists_profiles_without_their_pin(anon_client, make_profile):
    await make_profile("Ana")
    await make_profile("Luis")

    body = (await anon_client.get("/api/profiles")).json()

    assert [p["name"] for p in body] == ["Ana", "Luis"]
    assert "pin_hash" not in body[0]


async def test_create_profile_saves_cookies_photo_and_signs_in(
    anon_client, account, fetch, youtube, channel_service
):
    response = await create(anon_client, name=" Ana ")
    await channel_service.wait()

    body = response.json()
    assert response.status_code == 201
    assert body["name"] == "Ana"
    assert body["youtube_name"] == "Daniel Quesada"
    assert fetch.urls[0] == "https://yt3.ggpht.com/photo=s176"
    assert (await anon_client.get(body["avatar_url"])).status_code == 200
    cookies = cookies_path(uuid.UUID(body["id"]))
    assert cookies and Path(cookies).read_text() == normalize(COOKIES)  # noqa: ASYNC240
    assert account.files == [cookies]
    assert youtube.cookies == [cookies]
    assert (await anon_client.get("/api/session")).json()["id"] == body["id"]
    assert (await anon_client.get("/api/videos")).status_code == 200


async def test_profile_without_a_youtube_photo_keeps_the_default(anon_client, account):
    account.account = None

    body = (await create(anon_client)).json()

    assert body["avatar_url"] is None
    assert body["youtube_name"] is None


async def test_profile_can_be_created_offline(anon_client, account):
    connectivity.forced_offline = True

    response = await create(anon_client)

    assert response.status_code == 201
    assert account.files == []
    assert cookies_path(uuid.UUID(response.json()["id"]))


async def test_create_profile_validates_name_and_pin(anon_client):
    for name, pin in (("Ana", "12a4"), ("Ana", "123"), (" ", "1234")):
        assert (await create(anon_client, name=name, pin=pin)).status_code == 422


async def test_create_profile_rejects_cookies_without_a_youtube_session(anon_client):
    not_netscape = await create(anon_client, cookies="SAPISID=abc; LOGIN_INFO=def")
    signed_out = await create(anon_client, cookies=".youtube.com\tTRUE\t/\tTRUE\t0\tYSC\txyz\n")

    assert not_netscape.status_code == 422
    assert "cookies.txt" in not_netscape.json()["detail"]["message"]
    assert signed_out.status_code == 422
    assert "sesión" in signed_out.json()["detail"]["message"]
    assert (await anon_client.get("/api/profiles")).json() == []


def test_normalize_keeps_http_only_cookies_and_drops_comments():
    text = normalize("# comment\r\n" + COOKIES + "\n\nnot a cookie line\n")

    assert text.splitlines() == [
        "# Netscape HTTP Cookie File",
        ".youtube.com\tTRUE\t/\tTRUE\t0\tSAPISID\tabc",
        ".youtube.com\tTRUE\t/\tTRUE\t0\t__Secure-3PSID\tdef",
    ]


async def test_first_profile_gets_the_existing_library(anon_client):
    async with SessionLocal() as session:
        session.add(Video(youtube_id="old", title="Old", file_path="old/video.mp4", youtube_url=""))
        await session.commit()

    await create(anon_client)

    assert (await anon_client.get("/api/videos")).json()["total"] == 1


async def test_later_profiles_start_with_an_empty_library(anon_client, make_profile):
    await make_profile("Luis")
    async with SessionLocal() as session:
        session.add(Video(youtube_id="old", title="Old", file_path="old/video.mp4", youtube_url=""))
        await session.commit()

    await create(anon_client)

    assert (await anon_client.get("/api/videos")).json()["total"] == 0


async def test_profile_can_replace_its_cookies(client, profile, account, youtube, channel_service):
    response = await client.put(f"/api/profiles/{profile.id}/cookies", json={"cookies": COOKIES})
    await channel_service.wait()

    assert response.status_code == 200
    assert response.json()["youtube_name"] == "Daniel Quesada"
    assert account.files == [cookies_path(profile.id)]
    assert youtube.cookies == [cookies_path(profile.id)]


async def test_cannot_replace_the_cookies_of_another_profile(client, make_profile):
    other = await make_profile("Luis")
    response = await client.put(f"/api/profiles/{other.id}/cookies", json={"cookies": COOKIES})
    assert response.status_code == 403


async def test_unlock_with_the_right_pin(anon_client, make_profile):
    profile = await make_profile("Ana", "4321")

    response = await anon_client.post(f"/api/profiles/{profile.id}/unlock", json={"pin": "4321"})

    assert response.status_code == 200
    assert SESSION_COOKIE in response.cookies
    assert (await anon_client.get("/api/videos")).status_code == 200


async def test_wrong_pins_lock_the_profile(anon_client, make_profile):
    profile = await make_profile("Ana", "4321")
    url = f"/api/profiles/{profile.id}/unlock"

    remaining = [
        (await anon_client.post(url, json={"pin": "0000"})).json()["detail"]["remaining"]
        for _ in range(4)
    ]
    locked = await anon_client.post(url, json={"pin": "0000"})
    still_locked = await anon_client.post(url, json={"pin": "4321"})

    assert remaining == [4, 3, 2, 1]
    assert locked.status_code == 429
    assert locked.json()["detail"]["retry_after"] > 0
    assert still_locked.status_code == 429


async def test_tampered_session_is_rejected(anon_client, make_profile):
    profile = await make_profile()
    anon_client.cookies.set(SESSION_COOKIE, f"{profile.id}.9999999999.deadbeef")
    assert (await anon_client.get("/api/session")).status_code == 401


async def test_logout_ends_the_session(anon_client, profile):
    await anon_client.post(f"/api/profiles/{profile.id}/unlock", json={"pin": "1234"})
    assert (await anon_client.get("/api/session")).status_code == 200

    await anon_client.delete("/api/session")

    assert (await anon_client.get("/api/session")).status_code == 401


async def test_delete_profile_needs_its_pin(anon_client):
    profile = (await create(anon_client, pin="4321")).json()
    url = f"/api/profiles/{profile['id']}"

    wrong = await anon_client.request("DELETE", url, json={"pin": "0000"})
    right = await anon_client.request("DELETE", url, json={"pin": "4321"})

    assert wrong.status_code == 403
    assert right.status_code == 204
    assert (await anon_client.get("/api/profiles")).json() == []
    assert cookies_path(uuid.UUID(profile["id"])) is None
    assert (await anon_client.get("/api/session")).status_code == 401
