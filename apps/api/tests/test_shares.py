async def test_sharing_gives_the_same_link_every_time(client, make_video):
    video = await make_video()

    first = await client.post(f"/api/videos/{video.id}/share")
    second = await client.post(f"/api/videos/{video.id}/share")

    assert first.status_code == 201
    assert first.json()["url"] == f"/share/{first.json()['id']}"
    assert second.json()["id"] == first.json()["id"]


async def test_only_videos_in_the_library_can_be_shared(client, make_profile, make_video):
    other = await make_profile("Luis")
    video = await make_video(owners=[other])

    assert (await client.post(f"/api/videos/{video.id}/share")).status_code == 404


async def test_another_profile_sees_who_shared_and_saves_the_video(
    client, client_for, make_profile, make_video
):
    video = await make_video(channel="Canal")
    share = (await client.post(f"/api/videos/{video.id}/share")).json()
    other = await client_for(await make_profile("Luis"))

    preview = (await other.get(f"/api/shares/{share['id']}")).json()

    assert preview["shared_by"]["name"] == "Daniel"
    assert preview["video"]["title"] == video.title
    assert preview["video"]["channel"] == "Canal"
    assert preview["in_library"] is False
    assert (await other.get(preview["thumbnail_url"])).status_code == 200
    assert (await other.get(f"/api/videos/{video.id}")).status_code == 404

    saved = await other.post(f"/api/shares/{share['id']}/save")

    assert saved.status_code == 200
    assert saved.json()["id"] == str(video.id)
    assert [v["id"] for v in (await other.get("/api/videos")).json()["items"]] == [str(video.id)]
    assert (await other.get(f"/api/shares/{share['id']}")).json()["in_library"] is True
    assert (await other.post(f"/api/shares/{share['id']}/save")).status_code == 200


async def test_the_sharer_sees_the_video_already_in_its_library(client, make_video):
    video = await make_video()
    share = (await client.post(f"/api/videos/{video.id}/share")).json()

    assert (await client.get(f"/api/shares/{share['id']}")).json()["in_library"] is True


async def test_a_share_ends_when_its_video_leaves_the_disk(
    client, client_for, make_profile, make_video
):
    video = await make_video()
    share = (await client.post(f"/api/videos/{video.id}/share")).json()
    other = await client_for(await make_profile("Luis"))

    await client.delete(f"/api/videos/{video.id}")

    assert (await other.get(f"/api/shares/{share['id']}")).status_code == 404
    assert (await other.post(f"/api/shares/{share['id']}/save")).status_code == 404


async def test_a_saved_share_keeps_the_video_when_the_sharer_deletes_it(
    client, client_for, make_profile, make_video
):
    video = await make_video()
    share = (await client.post(f"/api/videos/{video.id}/share")).json()
    other = await client_for(await make_profile("Luis"))
    await other.post(f"/api/shares/{share['id']}/save")

    await client.delete(f"/api/videos/{video.id}")

    assert (await other.get(f"/api/videos/{video.id}/stream")).status_code == 200
    assert (await other.get(f"/api/shares/{share['id']}")).status_code == 200


async def test_shares_need_a_profile(anon_client, client, make_video):
    video = await make_video()
    share = (await client.post(f"/api/videos/{video.id}/share")).json()

    assert (await anon_client.get(f"/api/shares/{share['id']}")).status_code == 401
    assert (await anon_client.post(f"/api/shares/{share['id']}/save")).status_code == 401
