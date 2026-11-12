import uuid
from pathlib import Path

from app.db import SessionLocal
from app.models import ProfileStatus, Video
from app.services.connectivity import connectivity
from app.services.profiles import SESSION_COOKIE, cookies_path


async def test_endpoints_need_a_profile(anon_client):
    for path in ("/api/videos", "/api/downloads", "/api/channels", "/api/session"):
        assert (await anon_client.get(path)).status_code == 401
    assert (await anon_client.get("/api/status")).status_code == 200


async def test_picker_lists_only_ready_profiles(anon_client, make_profile):
    await make_profile("Ana")
    await make_profile("Luis", status=ProfileStatus.pending)

    body = (await anon_client.get("/api/profiles")).json()

    assert [p["name"] for p in body] == ["Ana"]
    assert "pin_hash" not in body[0]


async def test_create_profile_starts_a_pending_session(anon_client):
    response = await anon_client.post("/api/profiles", json={"name": " Ana ", "pin": "4321"})

    assert response.status_code == 201
    assert response.json()["name"] == "Ana"
    assert response.json()["status"] == "pending"
    session = (await anon_client.get("/api/session")).json()
    assert session["id"] == response.json()["id"]
    assert (await anon_client.get("/api/videos")).status_code == 401


async def test_create_profile_validates_name_and_pin(anon_client):
    for body in (
        {"name": "Ana", "pin": "12a4"},
        {"name": "Ana", "pin": "123"},
        {"name": " ", "pin": "1234"},
    ):
        assert (await anon_client.post("/api/profiles", json=body)).status_code == 422


async def test_create_profile_needs_a_connection(anon_client):
    connectivity.forced_offline = True
    response = await anon_client.post("/api/profiles", json={"name": "Ana", "pin": "1234"})
    assert response.status_code == 503


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


async def test_delete_profile_needs_its_pin(anon_client, make_profile):
    profile = await make_profile("Ana", "4321")
    url = f"/api/profiles/{profile.id}"

    wrong = await anon_client.request("DELETE", url, json={"pin": "0000"})
    right = await anon_client.request("DELETE", url, json={"pin": "4321"})

    assert wrong.status_code == 403
    assert right.status_code == 204
    assert (await anon_client.get("/api/profiles")).json() == []


async def test_pending_profile_is_cancelled_by_its_own_session(anon_client, make_profile):
    other = await make_profile("Luis", status=ProfileStatus.pending)
    created = (await anon_client.post("/api/profiles", json={"name": "Ana", "pin": "1234"})).json()

    assert (await anon_client.delete(f"/api/profiles/{other.id}")).status_code == 403
    assert (await anon_client.delete(f"/api/profiles/{created['id']}")).status_code == 204
    assert (await anon_client.get("/api/session")).status_code == 401


async def create(client, name="Ana", pin="1234"):
    return (await client.post("/api/profiles", json={"name": name, "pin": pin})).json()


async def test_creating_a_profile_opens_the_browser(anon_client, browser):
    profile = await create(anon_client)

    assert browser.calls == ["start"]
    assert str(browser.profile_id) == profile["id"]
    assert (await anon_client.get("/api/profiles/browser-auth")).status_code == 200


async def test_profile_waits_until_youtube_is_signed_in(anon_client, browser):
    profile = await create(anon_client)

    body = (await anon_client.get(f"/api/profiles/{profile['id']}/youtube")).json()

    assert body["state"] == "waiting"
    assert body["profile"]["status"] == "pending"
    assert (await anon_client.get("/api/profiles")).json() == []


async def test_signing_in_saves_cookies_photo_and_subscriptions(
    anon_client, browser, fetch, youtube, channel_service
):
    profile = await create(anon_client)
    browser.signed_in = True

    body = (await anon_client.get(f"/api/profiles/{profile['id']}/youtube")).json()
    await channel_service.wait()

    assert body["state"] == "ready"
    assert body["profile"]["status"] == "ready"
    assert body["profile"]["youtube_name"] == "Daniel Quesada"
    assert browser.calls == ["start", "stop"]
    assert fetch.urls[0] == "https://yt3.ggpht.com/photo=s176"
    assert (await anon_client.get(body["profile"]["avatar_url"])).status_code == 200
    cookies = cookies_path(uuid.UUID(profile["id"]))
    assert cookies and Path(cookies).read_text() == browser.COOKIES  # noqa: ASYNC240
    assert youtube.cookies == [cookies]
    assert (await anon_client.get("/api/videos")).status_code == 200
    assert (await anon_client.get("/api/profiles/browser-auth")).status_code == 401
    assert [p["name"] for p in (await anon_client.get("/api/profiles")).json()] == ["Ana"]


async def test_first_profile_gets_the_existing_library(anon_client, browser):
    async with SessionLocal() as session:
        session.add(Video(youtube_id="old", title="Old", file_path="old/video.mp4", youtube_url=""))
        await session.commit()
    profile = await create(anon_client)
    browser.signed_in = True
    await anon_client.get(f"/api/profiles/{profile['id']}/youtube")

    assert (await anon_client.get("/api/videos")).json()["total"] == 1


async def test_later_profiles_start_with_an_empty_library(
    anon_client, browser, make_video, make_profile
):
    await make_profile("Luis")
    await make_video("old", owners=[])
    profile = await create(anon_client)
    browser.signed_in = True
    await anon_client.get(f"/api/profiles/{profile['id']}/youtube")

    assert (await anon_client.get("/api/videos")).json()["total"] == 0


async def test_browser_is_only_open_to_the_profile_signing_in(anon_client, client, browser):
    await create(anon_client)

    assert (await client.get("/api/profiles/browser-auth")).status_code == 401
    anon_client.cookies.clear()
    assert (await anon_client.get("/api/profiles/browser-auth")).status_code == 401


async def test_profile_is_not_created_when_the_browser_is_down(anon_client, browser):
    browser.fail = True

    response = await anon_client.post("/api/profiles", json={"name": "Ana", "pin": "1234"})

    assert response.status_code == 503
    assert (await anon_client.get("/api/session")).status_code == 401


async def test_signed_in_profile_can_sign_in_again(client, profile, browser):
    response = await client.post(f"/api/profiles/{profile.id}/youtube")
    browser.signed_in = True
    done = (await client.get(f"/api/profiles/{profile.id}/youtube")).json()

    assert response.json()["state"] == "waiting"
    assert done["state"] == "ready"
    assert done["profile"]["youtube_name"] == "Daniel Quesada"


async def test_cannot_sign_in_for_another_profile(client, make_profile):
    other = await make_profile("Luis")
    assert (await client.post(f"/api/profiles/{other.id}/youtube")).status_code == 403
    assert (await client.get(f"/api/profiles/{other.id}/youtube")).status_code == 403


async def test_cancelling_a_pending_profile_closes_the_browser(anon_client, browser):
    profile = await create(anon_client)

    await anon_client.delete(f"/api/profiles/{profile['id']}")

    assert browser.calls == ["start", "stop"]


async def test_signing_in_again_can_be_cancelled(client, profile, browser):
    await client.post(f"/api/profiles/{profile.id}/youtube")

    response = await client.delete(f"/api/profiles/{profile.id}/youtube")

    assert response.status_code == 204
    assert browser.calls == ["start", "stop"]
    assert (await client.get("/api/profiles/browser-auth")).status_code == 401
