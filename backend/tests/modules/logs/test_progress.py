"""Integration tests for the progress analytics endpoints."""

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers (copied from test_sessions.py)
# ---------------------------------------------------------------------------


async def _make_org(client: AsyncClient, name: str = "Test Gym") -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register(
    client: AsyncClient,
    email: str = "athlete@example.com",
    password: str = "securepass",
    role: str = "athlete",
    org_id: str | None = None,
) -> str:
    body: dict = {"email": email, "password": password, "role": role}
    if org_id is not None:
        body["organization_id"] = org_id
    resp = await client.post("/api/v1/identity/auth/register", json=body)
    assert resp.status_code == 201
    return resp.json()["id"]


async def _auth_headers(client: AsyncClient, email: str, password: str = "securepass") -> dict:
    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _start_session(client: AsyncClient, headers: dict, **kwargs) -> dict:
    body = {"mode": "on_the_fly", **kwargs}
    resp = await client.post("/api/v1/logs/sessions", json=body, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def _finish_session(client: AsyncClient, headers: dict, session_id: str) -> None:
    resp = await client.patch(
        f"/api/v1/logs/sessions/{session_id}/finish", json={}, headers=headers
    )
    assert resp.status_code == 200


async def _add_catalog_exercise(client: AsyncClient, headers: dict) -> str:
    resp = await client.post(
        "/api/v1/training/exercises",
        json={
            "name": "Barbell Squat",
            "muscle_group": "quads",
            "equipment": "barbell",
            "movement_pattern": "squat",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _add_exercise_to_session(
    client: AsyncClient, headers: dict, session_id: str, exercise_id: str
) -> str:
    resp = await client.post(
        f"/api/v1/logs/sessions/{session_id}/exercises",
        json={"exercise_id": exercise_id},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _add_set(
    client: AsyncClient,
    headers: dict,
    session_id: str,
    logged_exercise_id: str,
    **kwargs,
) -> dict:
    body = {"weight_kg": 100.0, "reps": 5, **kwargs}
    resp = await client.post(
        f"/api/v1/logs/sessions/{session_id}/exercises/{logged_exercise_id}/sets",
        json=body,
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# GET /api/v1/logs/sessions/stats
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stats_new_user_returns_zeros(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Stats Zero Gym")
    await _register(client, email="statszero@test.com", org_id=org_id)
    headers = await _auth_headers(client, "statszero@test.com")

    resp = await client.get("/api/v1/logs/sessions/stats", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_sessions"] == 0
    assert data["total_volume_kg"] == 0.0
    assert data["sessions_this_month"] == 0
    assert data["avg_volume_per_session"] == 0.0


@pytest.mark.asyncio
async def test_stats_counts_only_finished_sessions(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Stats Unfinished Gym")
    await _register(client, email="statsunfinished@test.com", org_id=org_id)
    headers = await _auth_headers(client, "statsunfinished@test.com")

    # Start but do not finish
    await _start_session(client, headers)

    resp = await client.get("/api/v1/logs/sessions/stats", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total_sessions"] == 0


@pytest.mark.asyncio
async def test_stats_volume_excludes_non_counting_sets(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Stats Volume Gym")
    await _register(client, email="statsvolume@test.com", org_id=org_id)
    headers = await _auth_headers(client, "statsvolume@test.com")

    session = await _start_session(client, headers, name="Volume Test")
    exercise_id = (
        await client.post(
            f"/api/v1/logs/sessions/{session['id']}/exercises",
            json={"exercise_name_free": "Squat"},
            headers=headers,
        )
    ).json()["id"]

    # 3 working sets: 100kg × 5 = 500 each → 1500 total
    for _ in range(3):
        await _add_set(client, headers, session["id"], exercise_id, weight_kg=100.0, reps=5)
    # 1 warm-up set (counts_volume=False): should NOT be included
    await _add_set(
        client, headers, session["id"], exercise_id,
        weight_kg=60.0, reps=10, set_type="warm_up", counts_volume=False,
    )

    await _finish_session(client, headers, session["id"])

    resp = await client.get("/api/v1/logs/sessions/stats", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_sessions"] == 1
    assert data["total_volume_kg"] == pytest.approx(1500.0)


@pytest.mark.asyncio
async def test_stats_solo_user_no_org(client: AsyncClient) -> None:
    # Personal user (no organization_id)
    await _register(client, email="solouser@test.com")
    headers = await _auth_headers(client, "solouser@test.com")

    session = await _start_session(client, headers, name="Solo Session")
    await _finish_session(client, headers, session["id"])

    resp = await client.get("/api/v1/logs/sessions/stats", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total_sessions"] == 1


@pytest.mark.asyncio
async def test_stats_returns_401_without_token(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/logs/sessions/stats")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/v1/logs/sessions/volume-over-time
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_weekly_volume_no_sessions_returns_empty(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Weekly Empty Gym")
    await _register(client, email="weeklyempty@test.com", org_id=org_id)
    headers = await _auth_headers(client, "weeklyempty@test.com")

    resp = await client.get("/api/v1/logs/sessions/volume-over-time", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["points"] == []


@pytest.mark.asyncio
async def test_weekly_volume_finished_session_appears(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Weekly Volume Gym")
    await _register(client, email="weeklyvolume@test.com", org_id=org_id)
    headers = await _auth_headers(client, "weeklyvolume@test.com")

    session = await _start_session(client, headers, name="Volume Week")
    logged_ex_id = (
        await client.post(
            f"/api/v1/logs/sessions/{session['id']}/exercises",
            json={"exercise_name_free": "Deadlift"},
            headers=headers,
        )
    ).json()["id"]
    # 2 sets × 100kg × 5 reps = 1000 total
    await _add_set(client, headers, session["id"], logged_ex_id, weight_kg=100.0, reps=5)
    await _add_set(client, headers, session["id"], logged_ex_id, weight_kg=100.0, reps=5)

    await _finish_session(client, headers, session["id"])

    resp = await client.get("/api/v1/logs/sessions/volume-over-time", headers=headers)
    assert resp.status_code == 200
    points = resp.json()["points"]
    assert len(points) == 1
    assert points[0]["volume_kg"] == pytest.approx(1000.0)
    assert "week_start" in points[0]


@pytest.mark.asyncio
async def test_weekly_volume_custom_weeks_param(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Weekly Custom Gym")
    await _register(client, email="weeklycustom@test.com", org_id=org_id)
    headers = await _auth_headers(client, "weeklycustom@test.com")

    resp = await client.get(
        "/api/v1/logs/sessions/volume-over-time?weeks=4", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "points" in data
    assert isinstance(data["points"], list)


@pytest.mark.asyncio
async def test_weekly_volume_returns_401_without_token(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/logs/sessions/volume-over-time")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/v1/logs/exercises/catalog/{id}/history
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_exercise_history_empty_when_never_logged(client: AsyncClient) -> None:
    org_id = await _make_org(client, "ExHist Empty Gym")
    await _register(client, email="exhaistempty@test.com", org_id=org_id)
    headers = await _auth_headers(client, "exhaistempty@test.com")

    catalog_id = await _add_catalog_exercise(client, headers)

    resp = await client.get(
        f"/api/v1/logs/exercises/catalog/{catalog_id}/history", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["points"] == []


@pytest.mark.asyncio
async def test_exercise_history_returns_sessions_chronologically(client: AsyncClient) -> None:
    org_id = await _make_org(client, "ExHist Order Gym")
    await _register(client, email="exhaistorder@test.com", org_id=org_id)
    headers = await _auth_headers(client, "exhaistorder@test.com")

    catalog_id = await _add_catalog_exercise(client, headers)

    # Session 1: 80kg
    s1 = await _start_session(client, headers, name="Session A")
    ex1 = await _add_exercise_to_session(client, headers, s1["id"], catalog_id)
    await _add_set(client, headers, s1["id"], ex1, weight_kg=80.0, reps=5)
    await _finish_session(client, headers, s1["id"])

    # Session 2: 90kg
    s2 = await _start_session(client, headers, name="Session B")
    ex2 = await _add_exercise_to_session(client, headers, s2["id"], catalog_id)
    await _add_set(client, headers, s2["id"], ex2, weight_kg=90.0, reps=5)
    await _finish_session(client, headers, s2["id"])

    resp = await client.get(
        f"/api/v1/logs/exercises/catalog/{catalog_id}/history", headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    points = data["points"]
    assert len(points) == 2
    assert points[0]["best_weight_kg"] == pytest.approx(80.0)
    assert points[1]["best_weight_kg"] == pytest.approx(90.0)
    assert points[0]["session_date"] <= points[1]["session_date"]


@pytest.mark.asyncio
async def test_exercise_history_returns_401_without_token(client: AsyncClient) -> None:
    import uuid
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/logs/exercises/catalog/{fake_id}/history")
    assert resp.status_code == 401
