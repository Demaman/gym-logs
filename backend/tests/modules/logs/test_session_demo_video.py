"""Tests: demo_video_url is included in LoggedExerciseResponse from the backend."""

import pytest
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _make_org(client: AsyncClient, name: str) -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register(client: AsyncClient, org_id: str, email: str, role: str = "trainer") -> str:
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": email, "password": "securepass", "role": role, "organization_id": org_id},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _auth_headers(client: AsyncClient, email: str) -> dict:
    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": email, "password": "securepass"},
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _create_exercise(client: AsyncClient, headers: dict, *, name: str, demo_video_url: str | None = None) -> str:
    resp = await client.post(
        "/api/v1/training/exercises",
        json={
            "name": name,
            "muscle_group": "quads",
            "equipment": "barbell",
            "movement_pattern": "squat",
            "demo_video_url": demo_video_url,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_program_with_day(
    client: AsyncClient,
    headers: dict,
    *,
    exercise_id: str,
    pe_demo_video_url: str | None = None,
) -> tuple[str, str]:
    prog_resp = await client.post(
        "/api/v1/training/programs",
        json={"name": "Test Program"},
        headers=headers,
    )
    assert prog_resp.status_code == 201
    program_id = prog_resp.json()["id"]

    day_resp = await client.post(
        f"/api/v1/training/programs/{program_id}/days",
        json={"name": "Day 1", "position": 0, "day_tag": "legs"},
        headers=headers,
    )
    assert day_resp.status_code == 201
    day_id = day_resp.json()["id"]

    ex_resp = await client.post(
        f"/api/v1/training/days/{day_id}/exercises",
        json={"exercise_id": exercise_id, "position": 0, "demo_video_url": pe_demo_video_url},
        headers=headers,
    )
    assert ex_resp.status_code == 201

    return program_id, day_id


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_session_exercise_has_catalog_demo_video_url(client: AsyncClient) -> None:
    """When a session is started from a program day, demo_video_url from the catalog exercise
    appears on the logged exercise in the response."""
    org_id = await _make_org(client, "SDV Org1")
    await _register(client, org_id, "sdv1@example.com")
    headers = await _auth_headers(client, "sdv1@example.com")

    video_url = "https://www.youtube.com/watch?v=abc123"
    exercise_id = await _create_exercise(client, headers, name="Squat", demo_video_url=video_url)
    _, day_id = await _create_program_with_day(client, headers, exercise_id=exercise_id)

    resp = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "program_driven", "program_day_id": day_id},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["logged_exercises"]) == 1
    assert data["logged_exercises"][0]["demo_video_url"] == video_url


@pytest.mark.asyncio
async def test_session_exercise_program_url_overrides_catalog(client: AsyncClient) -> None:
    """When the program exercise has demo_video_url set, it overrides the catalog URL."""
    org_id = await _make_org(client, "SDV Org2")
    await _register(client, org_id, "sdv2@example.com")
    headers = await _auth_headers(client, "sdv2@example.com")

    catalog_url = "https://www.youtube.com/watch?v=catalog"
    program_url = "https://www.youtube.com/watch?v=program"
    exercise_id = await _create_exercise(client, headers, name="Deadlift", demo_video_url=catalog_url)
    _, day_id = await _create_program_with_day(
        client, headers, exercise_id=exercise_id, pe_demo_video_url=program_url
    )

    resp = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "program_driven", "program_day_id": day_id},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["logged_exercises"][0]["demo_video_url"] == program_url


@pytest.mark.asyncio
async def test_session_exercise_no_video_returns_null(client: AsyncClient) -> None:
    """Exercises with no demo_video_url return null."""
    org_id = await _make_org(client, "SDV Org3")
    await _register(client, org_id, "sdv3@example.com")
    headers = await _auth_headers(client, "sdv3@example.com")

    exercise_id = await _create_exercise(client, headers, name="Lunge")
    _, day_id = await _create_program_with_day(client, headers, exercise_id=exercise_id)

    resp = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "program_driven", "program_day_id": day_id},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["logged_exercises"][0]["demo_video_url"] is None


@pytest.mark.asyncio
async def test_get_session_includes_demo_video_url(client: AsyncClient) -> None:
    """GET /sessions/{id} also returns demo_video_url on logged exercises."""
    org_id = await _make_org(client, "SDV Org4")
    await _register(client, org_id, "sdv4@example.com")
    headers = await _auth_headers(client, "sdv4@example.com")

    video_url = "https://vimeo.com/123456789"
    exercise_id = await _create_exercise(client, headers, name="Romanian DL", demo_video_url=video_url)
    _, day_id = await _create_program_with_day(client, headers, exercise_id=exercise_id)

    start_resp = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "program_driven", "program_day_id": day_id},
        headers=headers,
    )
    session_id = start_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/logs/sessions/{session_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["logged_exercises"][0]["demo_video_url"] == video_url


@pytest.mark.asyncio
async def test_manually_added_exercise_with_catalog_video(client: AsyncClient) -> None:
    """An exercise added manually (not from a program) still shows the catalog video URL."""
    org_id = await _make_org(client, "SDV Org5")
    await _register(client, org_id, "sdv5@example.com")
    headers = await _auth_headers(client, "sdv5@example.com")

    video_url = "https://www.youtube.com/watch?v=manual"
    exercise_id = await _create_exercise(client, headers, name="Hip Thrust", demo_video_url=video_url)

    start_resp = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "on_the_fly"},
        headers=headers,
    )
    session_id = start_resp.json()["id"]

    add_resp = await client.post(
        f"/api/v1/logs/sessions/{session_id}/exercises",
        json={"exercise_id": exercise_id, "exercise_name_free": "Hip Thrust"},
        headers=headers,
    )
    assert add_resp.status_code == 201

    get_resp = await client.get(f"/api/v1/logs/sessions/{session_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["logged_exercises"][0]["demo_video_url"] == video_url
