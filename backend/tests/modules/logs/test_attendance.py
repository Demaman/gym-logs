"""Tests for attendance tracking — manual check-in + summary."""

import pytest
from httpx import AsyncClient


async def _make_org(client, name):
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register(client, email, role, org_id, pw="securepass"):
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": email, "password": pw, "role": role, "organization_id": org_id},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _login(client, email, pw="securepass"):
    resp = await client.post("/api/v1/identity/auth/login", json={"email": email, "password": pw})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_manual_checkin_by_admin(client: AsyncClient) -> None:
    org = await _make_org(client, "Att Gym 1")
    await _register(client, "admin-att@att1.com", "gym_admin", org)
    athlete_id = await _register(client, "ath-att@att1.com", "athlete", org)
    token = await _login(client, "admin-att@att1.com")

    resp = await client.post(
        "/api/v1/logs/attendance/checkin",
        json={"user_id": athlete_id},
        headers=_auth(token),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_manual_checkin_idempotent_same_day(client: AsyncClient) -> None:
    """Checking in the same member twice on the same day should not create duplicates."""
    org = await _make_org(client, "Att Gym 2")
    await _register(client, "admin-att2@att2.com", "gym_admin", org)
    athlete_id = await _register(client, "ath-att2@att2.com", "athlete", org)
    token = await _login(client, "admin-att2@att2.com")

    for _ in range(2):
        resp = await client.post(
            "/api/v1/logs/attendance/checkin",
            json={"user_id": athlete_id},
            headers=_auth(token),
        )
        assert resp.status_code == 204

    summary_resp = await client.get("/api/v1/logs/attendance/summary", headers=_auth(token))
    assert summary_resp.status_code == 200
    data = summary_resp.json()
    assert data["today_count"] == 1


@pytest.mark.asyncio
async def test_manual_checkin_forbidden_for_athlete(client: AsyncClient) -> None:
    org = await _make_org(client, "Att Gym 3")
    athlete_id = await _register(client, "ath-att3@att3.com", "athlete", org)
    other_id = await _register(client, "other-att3@att3.com", "athlete", org)
    token = await _login(client, "ath-att3@att3.com")

    resp = await client.post(
        "/api/v1/logs/attendance/checkin",
        json={"user_id": other_id},
        headers=_auth(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_attendance_summary_returns_structure(client: AsyncClient) -> None:
    org = await _make_org(client, "Att Gym 4")
    await _register(client, "admin-att4@att4.com", "gym_admin", org)
    token = await _login(client, "admin-att4@att4.com")

    resp = await client.get("/api/v1/logs/attendance/summary", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "today_count" in data
    assert "yesterday_count" in data
    assert "this_week_count" in data
    assert "last_week_count" in data
    assert "heatmap" in data
    assert "per_member" in data


@pytest.mark.asyncio
async def test_attendance_summary_forbidden_for_athlete(client: AsyncClient) -> None:
    org = await _make_org(client, "Att Gym 5")
    await _register(client, "ath-att5@att5.com", "athlete", org)
    token = await _login(client, "ath-att5@att5.com")

    resp = await client.get("/api/v1/logs/attendance/summary", headers=_auth(token))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_checkin_cross_org_member_returns_404(client: AsyncClient) -> None:
    org_a = await _make_org(client, "Att OrgA")
    await _register(client, "admin-a-att@oa.com", "gym_admin", org_a)
    org_b = await _make_org(client, "Att OrgB")
    athlete_b = await _register(client, "ath-b-att@ob.com", "athlete", org_b)

    token_a = await _login(client, "admin-a-att@oa.com")
    resp = await client.post(
        "/api/v1/logs/attendance/checkin",
        json={"user_id": athlete_b},
        headers=_auth(token_a),
    )
    assert resp.status_code == 404
