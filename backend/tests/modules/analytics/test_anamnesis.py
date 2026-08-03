"""Integration tests for the analytics module — athlete profile and body measurements."""

import pytest
from httpx import AsyncClient

# ── Helpers ───────────────────────────────────────────────────────────────────


async def _make_org(client: AsyncClient) -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": "Test Gym"})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register_and_login(client: AsyncClient, org_id: str, email: str = "athlete@test.com") -> dict:
    await client.post(
        "/api/v1/identity/auth/register",
        json={"email": email, "password": "testpass123", "role": "athlete", "organization_id": org_id},
    )
    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": email, "password": "testpass123"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── Profile tests ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_profile_auto_creates(client: AsyncClient):
    org_id = await _make_org(client)
    headers = await _register_and_login(client, org_id)

    resp = await client.get("/api/v1/analytics/profile", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert data["sex"] is None
    assert data["height_cm"] is None
    assert data["parq_cleared"] is False


@pytest.mark.asyncio
async def test_update_profile(client: AsyncClient):
    org_id = await _make_org(client)
    headers = await _register_and_login(client, org_id, "update@test.com")

    payload = {
        "sex": "male",
        "height_cm": 180.5,
        "training_age_years": 5,
        "primary_goal": "hypertrophy",
        "parq_cleared": True,
        "injury_history": "Left knee sprain 2021",
    }
    resp = await client.put("/api/v1/analytics/profile", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["sex"] == "male"
    assert data["height_cm"] == 180.5
    assert data["training_age_years"] == 5
    assert data["primary_goal"] == "hypertrophy"
    assert data["parq_cleared"] is True
    assert data["injury_history"] == "Left knee sprain 2021"


@pytest.mark.asyncio
async def test_get_profile_returns_updated_values(client: AsyncClient):
    org_id = await _make_org(client)
    headers = await _register_and_login(client, org_id, "persist@test.com")

    await client.put(
        "/api/v1/analytics/profile",
        json={"height_cm": 175.0, "dominant_side": "right"},
        headers=headers,
    )
    resp = await client.get("/api/v1/analytics/profile", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["height_cm"] == 175.0
    assert resp.json()["dominant_side"] == "right"


@pytest.mark.asyncio
async def test_profile_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/analytics/profile")
    assert resp.status_code == 401


# ── Measurement tests ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_measurement(client: AsyncClient):
    org_id = await _make_org(client)
    headers = await _register_and_login(client, org_id, "measure@test.com")

    payload = {
        "measured_at": "2026-07-01",
        "weight_kg": 80.5,
        "body_fat_pct": 15.2,
        "waist_cm": 82.0,
        "resting_hr": 58,
        "bp_systolic": 120,
        "bp_diastolic": 80,
    }
    resp = await client.post("/api/v1/analytics/measurements", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["weight_kg"] == 80.5
    assert data["body_fat_pct"] == 15.2
    assert data["resting_hr"] == 58


@pytest.mark.asyncio
async def test_list_measurements(client: AsyncClient):
    org_id = await _make_org(client)
    headers = await _register_and_login(client, org_id, "listm@test.com")

    for date in ["2026-06-01", "2026-07-01"]:
        await client.post(
            "/api/v1/analytics/measurements",
            json={"measured_at": date, "weight_kg": 80.0},
            headers=headers,
        )

    resp = await client.get("/api/v1/analytics/measurements", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2


@pytest.mark.asyncio
async def test_update_measurement(client: AsyncClient):
    org_id = await _make_org(client)
    headers = await _register_and_login(client, org_id, "editm@test.com")

    create_resp = await client.post(
        "/api/v1/analytics/measurements",
        json={"measured_at": "2026-07-01", "weight_kg": 80.0},
        headers=headers,
    )
    mid = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/analytics/measurements/{mid}",
        json={"weight_kg": 79.2, "notes": "Morning weight"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["weight_kg"] == 79.2
    assert resp.json()["notes"] == "Morning weight"


@pytest.mark.asyncio
async def test_delete_measurement(client: AsyncClient):
    org_id = await _make_org(client)
    headers = await _register_and_login(client, org_id, "deletem@test.com")

    create_resp = await client.post(
        "/api/v1/analytics/measurements",
        json={"measured_at": "2026-07-01", "weight_kg": 85.0},
        headers=headers,
    )
    mid = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/analytics/measurements/{mid}", headers=headers)
    assert del_resp.status_code == 204

    list_resp = await client.get("/api/v1/analytics/measurements", headers=headers)
    assert list_resp.json() == []


@pytest.mark.asyncio
async def test_measurement_not_found_returns_404(client: AsyncClient):
    org_id = await _make_org(client)
    headers = await _register_and_login(client, org_id, "404m@test.com")

    import uuid
    fake_id = str(uuid.uuid4())
    resp = await client.patch(
        f"/api/v1/analytics/measurements/{fake_id}",
        json={"weight_kg": 80.0},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_measurements_require_auth(client: AsyncClient):
    resp = await client.get("/api/v1/analytics/measurements")
    assert resp.status_code == 401


# ── Trainer-scoped tests ──────────────────────────────────────────────────────


async def _register_trainer(client: AsyncClient, org_id: str, email: str = "trainer@test.com") -> dict:
    await client.post(
        "/api/v1/identity/auth/register",
        json={"email": email, "password": "testpass123", "role": "trainer", "organization_id": org_id},
    )
    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": email, "password": "testpass123"},
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.mark.asyncio
async def test_trainer_list_athletes(client: AsyncClient):
    org_id = await _make_org(client)
    trainer_headers = await _register_trainer(client, org_id)
    # Get trainer id
    trainer_id = (await client.get("/api/v1/identity/users/me", headers=trainer_headers)).json()["id"]

    # Register athletes and capture their ids
    a1_reg = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": "a1@test.com", "password": "testpass123", "role": "athlete", "organization_id": org_id},
    )
    a1_id = a1_reg.json()["id"]

    a2_reg = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": "a2@test.com", "password": "testpass123", "role": "athlete", "organization_id": org_id},
    )
    a2_id = a2_reg.json()["id"]

    # Create memberships so trainer is linked to both athletes
    await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": trainer_id, "athlete_id": a1_id},
        headers=trainer_headers,
    )
    await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": trainer_id, "athlete_id": a2_id},
        headers=trainer_headers,
    )

    resp = await client.get("/api/v1/identity/members/athletes", headers=trainer_headers)
    assert resp.status_code == 200
    athletes = resp.json()
    emails = [a["email"] for a in athletes]
    assert "a1@test.com" in emails
    assert "a2@test.com" in emails
    assert all(a["role"] == "athlete" for a in athletes)


@pytest.mark.asyncio
async def test_trainer_get_athlete_profile(client: AsyncClient):
    org_id = await _make_org(client)
    trainer_headers = await _register_trainer(client, org_id, "trainer2@test.com")
    athlete_headers = await _register_and_login(client, org_id, "ath2@test.com")

    me_resp = await client.get("/api/v1/identity/users/me", headers=athlete_headers)
    athlete_id = me_resp.json()["id"]

    resp = await client.get(f"/api/v1/analytics/athletes/{athlete_id}/profile", headers=trainer_headers)
    assert resp.status_code == 200
    assert resp.json()["user_id"] == athlete_id


@pytest.mark.asyncio
async def test_trainer_update_athlete_profile(client: AsyncClient):
    org_id = await _make_org(client)
    trainer_headers = await _register_trainer(client, org_id, "trainer3@test.com")
    athlete_headers = await _register_and_login(client, org_id, "ath3@test.com")

    me_resp = await client.get("/api/v1/identity/users/me", headers=athlete_headers)
    athlete_id = me_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/analytics/athletes/{athlete_id}/profile",
        json={"height_cm": 182.0, "primary_goal": "strength"},
        headers=trainer_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["height_cm"] == 182.0
    assert resp.json()["primary_goal"] == "strength"


@pytest.mark.asyncio
async def test_trainer_create_athlete_measurement(client: AsyncClient):
    org_id = await _make_org(client)
    trainer_headers = await _register_trainer(client, org_id, "trainer4@test.com")
    athlete_headers = await _register_and_login(client, org_id, "ath4@test.com")

    me_resp = await client.get("/api/v1/identity/users/me", headers=athlete_headers)
    athlete_id = me_resp.json()["id"]

    resp = await client.post(
        f"/api/v1/analytics/athletes/{athlete_id}/measurements",
        json={"measured_at": "2026-07-01", "weight_kg": 77.5},
        headers=trainer_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["weight_kg"] == 77.5


@pytest.mark.asyncio
async def test_athlete_cannot_access_trainer_endpoints(client: AsyncClient):
    org_id = await _make_org(client)
    athlete_headers = await _register_and_login(client, org_id, "nottrainer@test.com")

    import uuid
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/analytics/athletes/{fake_id}/profile", headers=athlete_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_trainer_list_athletes_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/identity/members/athletes")
    assert resp.status_code == 401
