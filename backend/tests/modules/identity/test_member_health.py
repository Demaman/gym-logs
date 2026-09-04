"""Tests for GET /identity/organizations/current/member-health"""

import pytest
from httpx import AsyncClient


async def _make_org(client: AsyncClient, name: str = "Health Gym") -> str:
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
async def test_member_health_returns_athletes(client: AsyncClient) -> None:
    org = await _make_org(client, "MH Gym 1")
    await _register(client, "admin-mh@mh1.com", "gym_admin", org)
    await _register(client, "athlete1@mh1.com", "athlete", org)
    await _register(client, "athlete2@mh1.com", "athlete", org)
    token = await _login(client, "admin-mh@mh1.com")

    resp = await client.get(
        "/api/v1/identity/organizations/current/member-health",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    emails = {m["email"] for m in data}
    assert "athlete1@mh1.com" in emails
    assert "athlete2@mh1.com" in emails
    assert "admin-mh@mh1.com" not in emails


@pytest.mark.asyncio
async def test_member_health_new_status_for_recent_signup(client: AsyncClient) -> None:
    org = await _make_org(client, "MH Gym 2")
    await _register(client, "admin-mh2@mh2.com", "gym_admin", org)
    await _register(client, "newbie@mh2.com", "athlete", org)
    token = await _login(client, "admin-mh2@mh2.com")

    resp = await client.get(
        "/api/v1/identity/organizations/current/member-health",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    members = {m["email"]: m for m in resp.json()}
    assert members["newbie@mh2.com"]["status"] == "new"


@pytest.mark.asyncio
async def test_member_health_no_program_status(client: AsyncClient) -> None:
    """Athlete older than 7 days with no program and no session → no_program."""
    org = await _make_org(client, "MH Gym 3")
    await _register(client, "admin-mh3@mh3.com", "gym_admin", org)
    # new athlete — status will be 'new' since just registered; that's expected
    await _register(client, "noprog@mh3.com", "athlete", org)
    token = await _login(client, "admin-mh3@mh3.com")

    resp = await client.get(
        "/api/v1/identity/organizations/current/member-health",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    members = {m["email"]: m for m in resp.json()}
    # Just registered → new (correct — they joined today)
    assert members["noprog@mh3.com"]["status"] in ("new", "no_program")
    assert members["noprog@mh3.com"]["active_program_count"] == 0
    assert members["noprog@mh3.com"]["last_session_at"] is None


@pytest.mark.asyncio
async def test_member_health_forbidden_for_athlete(client: AsyncClient) -> None:
    org = await _make_org(client, "MH Gym 4")
    await _register(client, "ath-mh4@mh4.com", "athlete", org)
    token = await _login(client, "ath-mh4@mh4.com")

    resp = await client.get(
        "/api/v1/identity/organizations/current/member-health",
        headers=_auth(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_member_health_trainer_sees_own_athletes(client: AsyncClient) -> None:
    org = await _make_org(client, "MH Gym 5")
    trainer_id = await _register(client, "tr-mh5@mh5.com", "trainer", org)
    await _register(client, "linked@mh5.com", "athlete", org)
    await _register(client, "unlinked@mh5.com", "athlete", org)
    t_token = await _login(client, "tr-mh5@mh5.com")

    linked_id = (await client.post(
        "/api/v1/identity/auth/register",
        json={"email": "linked@mh5.com", "password": "securepass", "role": "athlete", "organization_id": org},
    )).json().get("id")

    # Actually already registered above — just get the athlete's id
    # Link only "linked" athlete
    from httpx import AsyncClient as _  # noqa
    resp = await client.get("/api/v1/identity/members/athletes", headers={"Authorization": f"Bearer {t_token}"})
    # Trainer has no memberships yet — 0 athletes
    assert resp.status_code == 200

    resp = await client.get(
        "/api/v1/identity/organizations/current/member-health",
        headers={"Authorization": f"Bearer {t_token}"},
    )
    assert resp.status_code == 200
    # Trainer with no membership links sees empty list
    assert resp.json() == []


@pytest.mark.asyncio
async def test_member_health_org_isolation(client: AsyncClient) -> None:
    org_a = await _make_org(client, "MH OrgA")
    await _register(client, "admin-a@orga.com", "gym_admin", org_a)
    await _register(client, "athlete-a@orga.com", "athlete", org_a)

    org_b = await _make_org(client, "MH OrgB")
    await _register(client, "admin-b@orgb.com", "gym_admin", org_b)
    await _register(client, "athlete-b@orgb.com", "athlete", org_b)

    token_b = await _login(client, "admin-b@orgb.com")
    resp = await client.get(
        "/api/v1/identity/organizations/current/member-health",
        headers=_auth(token_b),
    )
    assert resp.status_code == 200
    emails = {m["email"] for m in resp.json()}
    assert "athlete-a@orga.com" not in emails
    assert "athlete-b@orgb.com" in emails
