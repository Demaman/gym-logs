"""Tests for demo_video_url on ProgramExercise (Option B)."""

import pytest
from httpx import AsyncClient


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


async def _bootstrap(client: AsyncClient, suffix: str):
    """Return (trainer_headers, program_id, day_id, exercise_id)."""
    org_id = await _make_org(client, f"PEVidGym-{suffix}")
    await _register(client, org_id, f"pevid{suffix}@example.com")
    headers = await _auth_headers(client, f"pevid{suffix}@example.com")

    # Create a catalog exercise
    ex_resp = await client.post(
        "/api/v1/training/exercises",
        json={"name": f"Squat-{suffix}", "muscle_group": "quads", "equipment": "barbell", "movement_pattern": "squat"},
        headers=headers,
    )
    assert ex_resp.status_code == 201
    exercise_id = ex_resp.json()["id"]

    # Create a program + day
    prog_resp = await client.post(
        "/api/v1/training/programs",
        json={"name": f"Prog-{suffix}", "mode": "program_driven"},
        headers=headers,
    )
    assert prog_resp.status_code == 201
    program_id = prog_resp.json()["id"]

    day_resp = await client.post(
        f"/api/v1/training/programs/{program_id}/days",
        json={"name": "Day 1", "position": 1, "day_tag": "legs"},
        headers=headers,
    )
    assert day_resp.status_code == 201
    day_id = day_resp.json()["id"]

    return headers, program_id, day_id, exercise_id


@pytest.mark.asyncio
async def test_add_exercise_with_demo_video_url(client: AsyncClient) -> None:
    headers, _, day_id, exercise_id = await _bootstrap(client, "1")

    pe_resp = await client.post(
        f"/api/v1/training/days/{day_id}/exercises",
        json={"exercise_id": exercise_id, "position": 1, "demo_video_url": "https://youtu.be/dQw4w9WgXcQ"},
        headers=headers,
    )
    assert pe_resp.status_code == 201
    assert pe_resp.json()["demo_video_url"] == "https://youtu.be/dQw4w9WgXcQ"


@pytest.mark.asyncio
async def test_add_exercise_without_demo_video_url(client: AsyncClient) -> None:
    headers, _, day_id, exercise_id = await _bootstrap(client, "2")

    pe_resp = await client.post(
        f"/api/v1/training/days/{day_id}/exercises",
        json={"exercise_id": exercise_id, "position": 1},
        headers=headers,
    )
    assert pe_resp.status_code == 201
    assert pe_resp.json()["demo_video_url"] is None


@pytest.mark.asyncio
async def test_patch_program_exercise_sets_video_url(client: AsyncClient) -> None:
    headers, _, day_id, exercise_id = await _bootstrap(client, "3")

    pe_resp = await client.post(
        f"/api/v1/training/days/{day_id}/exercises",
        json={"exercise_id": exercise_id, "position": 1},
        headers=headers,
    )
    pe_id = pe_resp.json()["id"]
    assert pe_resp.json()["demo_video_url"] is None

    patch = await client.patch(
        f"/api/v1/training/program-exercises/{pe_id}",
        json={"demo_video_url": "https://vimeo.com/123456789"},
        headers=headers,
    )
    assert patch.status_code == 200
    assert patch.json()["demo_video_url"] == "https://vimeo.com/123456789"


@pytest.mark.asyncio
async def test_patch_program_exercise_clears_video_url(client: AsyncClient) -> None:
    headers, _, day_id, exercise_id = await _bootstrap(client, "4")

    pe_resp = await client.post(
        f"/api/v1/training/days/{day_id}/exercises",
        json={"exercise_id": exercise_id, "position": 1, "demo_video_url": "https://youtu.be/abc"},
        headers=headers,
    )
    pe_id = pe_resp.json()["id"]

    patch = await client.patch(
        f"/api/v1/training/program-exercises/{pe_id}",
        json={"demo_video_url": None},
        headers=headers,
    )
    assert patch.status_code == 200
    assert patch.json()["demo_video_url"] is None


@pytest.mark.asyncio
async def test_demo_video_url_in_program_response(client: AsyncClient) -> None:
    """Video URL should appear nested inside the full program response."""
    headers, program_id, day_id, exercise_id = await _bootstrap(client, "5")

    await client.post(
        f"/api/v1/training/days/{day_id}/exercises",
        json={"exercise_id": exercise_id, "position": 1, "demo_video_url": "https://youtu.be/test123"},
        headers=headers,
    )

    prog = await client.get(f"/api/v1/training/programs/{program_id}", headers=headers)
    assert prog.status_code == 200
    pe = prog.json()["days"][0]["exercises"][0]
    assert pe["demo_video_url"] == "https://youtu.be/test123"
