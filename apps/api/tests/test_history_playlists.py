import uuid


async def test_watching_records_the_history_newest_first(client, make_video):
    first = await make_video("first", title="Cooking pasta")
    second = await make_video("second", title="Learning FastAPI")

    await client.put(f"/api/history/{first.id}", json={"position": 30, "duration": 120})
    await client.put(f"/api/history/{second.id}", json={"position": 5, "duration": 60})
    await client.put(f"/api/history/{first.id}", json={"position": 90, "duration": 120})

    body = (await client.get("/api/history")).json()
    assert body["total"] == 2
    assert [entry["video"]["youtube_id"] for entry in body["items"]] == ["first", "second"]
    assert body["items"][0]["position"] == 90
    searched = (await client.get("/api/history", params={"q": "fastapi"})).json()
    assert [entry["video"]["youtube_id"] for entry in searched["items"]] == ["second"]


async def test_history_entries_can_be_removed_or_cleared(client, make_video):
    one = await make_video("one")
    two = await make_video("two")
    for video in (one, two):
        await client.put(f"/api/history/{video.id}", json={"position": 1})

    await client.delete(f"/api/history/{one.id}")
    assert [e["video"]["id"] for e in (await client.get("/api/history")).json()["items"]] == [
        str(two.id)
    ]

    await client.delete("/api/history")
    assert (await client.get("/api/history")).json()["total"] == 0


async def test_history_is_private_to_each_profile(client, client_for, make_profile, make_video):
    other = await make_profile("Luis")
    video = await make_video("shared", owners=None)
    await client.put(f"/api/history/{video.id}", json={"position": 1})

    other_client = await client_for(other)
    assert (await other_client.get("/api/history")).json()["total"] == 0
    response = await other_client.put(f"/api/history/{video.id}", json={"position": 1})
    assert response.status_code == 404


async def test_every_profile_has_watch_later_and_liked(client):
    body = (await client.get("/api/playlists")).json()

    assert [(p["kind"], p["name"], p["count"]) for p in body] == [
        ("watch_later", "Ver más tarde", 0),
        ("liked", "Videos que me gustan", 0),
    ]
    assert len((await client.get("/api/playlists")).json()) == 2


async def test_playlist_keeps_videos_in_the_order_they_were_added(client, make_video):
    one = await make_video("one", duration_seconds=60)
    two = await make_video("two", duration_seconds=90)
    playlist = (await client.post("/api/playlists", json={"name": " Viajes "})).json()
    url = f"/api/playlists/{playlist['id']}"

    await client.put(f"{url}/videos/{two.id}")
    await client.put(f"{url}/videos/{one.id}")
    await client.put(f"{url}/videos/{two.id}")

    detail = (await client.get(url)).json()
    assert detail["name"] == "Viajes"
    assert [item["video"]["youtube_id"] for item in detail["items"]] == ["two", "one"]
    assert detail["count"] == 2
    assert detail["duration_seconds"] == 150
    assert detail["thumbnail_url"] == f"/api/videos/{two.id}/thumbnail"

    await client.delete(f"{url}/videos/{two.id}")
    assert [i["video"]["youtube_id"] for i in (await client.get(url)).json()["items"]] == ["one"]


async def test_playlists_say_whether_they_hold_a_video(client, make_video):
    video = await make_video("one")
    watch_later = (await client.get("/api/playlists")).json()[0]
    await client.put(f"/api/playlists/{watch_later['id']}/videos/{video.id}")

    body = (await client.get("/api/playlists", params={"video_id": str(video.id)})).json()

    assert [p["contains"] for p in body] == [True, False]


async def test_custom_playlists_can_be_renamed_and_deleted_but_system_ones_cannot(client):
    custom = (await client.post("/api/playlists", json={"name": "Viajes"})).json()
    liked = (await client.get("/api/playlists")).json()[1]

    renamed = await client.patch(f"/api/playlists/{custom['id']}", json={"name": "Música"})
    assert renamed.json()["name"] == "Música"
    assert (await client.delete(f"/api/playlists/{custom['id']}")).status_code == 204
    assert (
        await client.patch(f"/api/playlists/{liked['id']}", json={"name": "x"})
    ).status_code == 409
    assert (await client.delete(f"/api/playlists/{liked['id']}")).status_code == 409


async def test_playlists_are_private_to_each_profile(client, client_for, make_profile, make_video):
    other = await make_profile("Luis")
    playlist = (await client.post("/api/playlists", json={"name": "Mía"})).json()
    other_client = await client_for(other)

    assert (await other_client.get(f"/api/playlists/{playlist['id']}")).status_code == 404
    assert [p["name"] for p in (await other_client.get("/api/playlists")).json()] == [
        "Ver más tarde",
        "Videos que me gustan",
    ]
    assert (
        await client.put(f"/api/playlists/{playlist['id']}/videos/{uuid.uuid4()}")
    ).status_code == 404


async def test_removing_a_video_from_the_library_drops_it_from_history_and_playlists(
    client, make_video
):
    video = await make_video("gone")
    playlist = (await client.post("/api/playlists", json={"name": "Viajes"})).json()
    await client.put(f"/api/playlists/{playlist['id']}/videos/{video.id}")
    await client.put(f"/api/history/{video.id}", json={"position": 1})

    await client.delete(f"/api/videos/{video.id}")

    assert (await client.get(f"/api/playlists/{playlist['id']}")).json()["count"] == 0
    assert (await client.get("/api/history")).json()["total"] == 0
