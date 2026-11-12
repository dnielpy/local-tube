from app.models import ProfileStatus
from app.services.connectivity import connectivity
from app.services.profiles import SESSION_COOKIE


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
