from app.services.connectivity import Connectivity, connectivity


async def test_status_reports_online_when_reachable(client):
    body = (await client.get("/api/status")).json()
    assert body["online"] is True
    assert body["forced_offline"] is False


async def test_forced_offline_overrides_reachability_and_persists(client):
    response = await client.put("/api/status", json={"forced_offline": True})

    assert response.json()["online"] is False
    assert response.json()["reachable"] is True
    fresh = Connectivity()
    await fresh.load()
    assert fresh.forced_offline is True


async def test_offline_when_youtube_unreachable(client):
    connectivity.reachable = False
    assert (await client.get("/api/status")).json()["online"] is False


async def test_check_uses_probe_result():
    monitor = Connectivity()
    results = iter([False, True])

    async def probe() -> bool:
        return next(results)

    monitor._probe = probe
    await monitor.check()
    assert monitor.reachable is False
    await monitor.check()
    assert monitor.online is True
    assert monitor.checked_at is not None
