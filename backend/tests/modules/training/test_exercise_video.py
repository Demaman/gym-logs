"""Tests for exercise demo_video_url — URL storage and file upload."""

import io

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers (duplicated from test_training to keep this file self-contained)
# ---------------------------------------------------------------------------


async def _make_org(client: AsyncClient, name: str = "Test Gym") -> str:
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


async def _create_exercise(client: AsyncClient, headers: dict, name: str = "Squat", **extra) -> dict:
    body = {
        "name": name,
        "muscle_group": "quads",
        "equipment": "barbell",
        "movement_pattern": "squat",
        **extra,
    }
    resp = await client.post("/api/v1/training/exercises", json=body, headers=headers)
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_exercise_with_video_url(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Video Gym 1")
    await _register(client, org_id, "trainer1@example.com")
    headers = await _auth_headers(client, "trainer1@example.com")

    video_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    ex = await _create_exercise(client, headers, demo_video_url=video_url)

    assert ex["demo_video_url"] == video_url


@pytest.mark.asyncio
async def test_create_exercise_without_video_url(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Video Gym 2")
    await _register(client, org_id, "trainer2@example.com")
    headers = await _auth_headers(client, "trainer2@example.com")

    ex = await _create_exercise(client, headers)

    assert ex["demo_video_url"] is None


@pytest.mark.asyncio
async def test_update_exercise_sets_video_url(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Video Gym 3")
    await _register(client, org_id, "trainer3@example.com")
    headers = await _auth_headers(client, "trainer3@example.com")

    ex = await _create_exercise(client, headers)
    assert ex["demo_video_url"] is None

    video_url = "https://vimeo.com/123456789"
    resp = await client.put(
        f"/api/v1/training/exercises/{ex['id']}",
        json={"demo_video_url": video_url},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["demo_video_url"] == video_url


@pytest.mark.asyncio
async def test_update_exercise_clears_video_url(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Video Gym 4")
    await _register(client, org_id, "trainer4@example.com")
    headers = await _auth_headers(client, "trainer4@example.com")

    video_url = "https://www.youtube.com/watch?v=abc123"
    ex = await _create_exercise(client, headers, demo_video_url=video_url)
    assert ex["demo_video_url"] == video_url

    # Explicitly clear by sending null
    resp = await client.put(
        f"/api/v1/training/exercises/{ex['id']}",
        json={"demo_video_url": None},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["demo_video_url"] is None


@pytest.mark.asyncio
async def test_upload_video_invalid_mime_returns_422(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Video Gym 5")
    await _register(client, org_id, "trainer5@example.com")
    headers = await _auth_headers(client, "trainer5@example.com")

    ex = await _create_exercise(client, headers)

    fake_txt = io.BytesIO(b"not a video")
    resp = await client.post(
        f"/api/v1/training/exercises/{ex['id']}/video",
        files={"file": ("demo.txt", fake_txt, "text/plain")},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_upload_video_stores_url_in_db(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Video Gym 6")
    await _register(client, org_id, "trainer6@example.com")
    headers = await _auth_headers(client, "trainer6@example.com")

    ex = await _create_exercise(client, headers)
    assert ex["demo_video_url"] is None

    # Minimal valid mp4 bytes (ftyp box)
    mp4_bytes = (
        b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00"
        b"isomiso2avc1mp41"
    )
    fake_mp4 = io.BytesIO(mp4_bytes)
    resp = await client.post(
        f"/api/v1/training/exercises/{ex['id']}/video",
        files={"file": ("demo.mp4", fake_mp4, "video/mp4")},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["demo_video_url"] is not None
    assert data["demo_video_url"].startswith("/media/exercises/")
    assert data["demo_video_url"].endswith(".mp4")


@pytest.mark.asyncio
async def test_upload_video_athlete_returns_403(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Video Gym 7")
    await _register(client, org_id, "trainer7@example.com", role="trainer")
    await _register(client, org_id, "athlete7@example.com", role="athlete")
    trainer_headers = await _auth_headers(client, "trainer7@example.com")
    athlete_headers = await _auth_headers(client, "athlete7@example.com")

    ex = await _create_exercise(client, trainer_headers)

    fake_mp4 = io.BytesIO(b"\x00" * 16)
    resp = await client.post(
        f"/api/v1/training/exercises/{ex['id']}/video",
        files={"file": ("demo.mp4", fake_mp4, "video/mp4")},
        headers=athlete_headers,
    )
    assert resp.status_code == 403
