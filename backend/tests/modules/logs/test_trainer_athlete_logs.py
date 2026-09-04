"""Integration tests — trainer/gym_admin read access to athlete log data."""

import uuid

import pytest
from httpx import AsyncClient


def _ue(prefix: str) -> str:
    """Unique email to avoid cross-test conflicts in the shared test DB."""
    return f"{prefix}+{uuid.uuid4().hex[:8]}@example.com"


async def _make_org(client: AsyncClient, name: str = "Test Gym") -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register(
    client: AsyncClient,
    org_id: str,
    email: str,
    role: str = "athlete",
    password: str = "securepass",
) -> str:
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": email, "password": password, "role": role, "organization_id": org_id},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _login(client: AsyncClient, email: str, password: str = "securepass") -> dict:
    resp = await client.post(
        "/api/v1/identity/auth/login", json={"email": email, "password": password}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _start_and_finish_session(client: AsyncClient, headers: dict) -> str:
    r = await client.post("/api/v1/logs/sessions", json={"mode": "on_the_fly"}, headers=headers)
    assert r.status_code == 201
    sid = r.json()["id"]
    r2 = await client.patch(f"/api/v1/logs/sessions/{sid}/finish", json={}, headers=headers)
    assert r2.status_code == 200
    return sid


@pytest.fixture
async def trainer_and_athlete(client: AsyncClient):
    ath_email = _ue("ath")
    tr_email = _ue("trainer")
    admin_email = _ue("admin")

    org_id = await _make_org(client, "Trainer Gym")
    athlete_id = await _register(client, org_id, ath_email, role="athlete")
    trainer_id = await _register(client, org_id, tr_email, role="trainer")
    admin_id = await _register(client, org_id, admin_email, role="gym_admin")

    # Link athlete to trainer
    trainer_h = await _login(client, tr_email)
    await client.post(
        "/api/v1/identity/memberships",
        json={"athlete_email": ath_email},
        headers=trainer_h,
    )

    ath_h = await _login(client, ath_email)
    admin_h = await _login(client, admin_email)

    return {
        "org_id": org_id,
        "athlete_id": athlete_id,
        "trainer_id": trainer_id,
        "admin_id": admin_id,
        "ath_headers": ath_h,
        "trainer_headers": trainer_h,
        "admin_headers": admin_h,
    }


# ── list sessions ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trainer_can_list_athlete_sessions(client: AsyncClient, trainer_and_athlete):
    ctx = trainer_and_athlete
    ath_h, trainer_h = ctx["ath_headers"], ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    await _start_and_finish_session(client, ath_h)

    resp = await client.get(
        f"/api/v1/logs/athletes/{athlete_id}/sessions", headers=trainer_h
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["athlete_id"] == athlete_id


@pytest.mark.asyncio
async def test_gym_admin_can_list_athlete_sessions(client: AsyncClient, trainer_and_athlete):
    ctx = trainer_and_athlete
    ath_h, admin_h = ctx["ath_headers"], ctx["admin_headers"]
    athlete_id = ctx["athlete_id"]

    await _start_and_finish_session(client, ath_h)

    resp = await client.get(
        f"/api/v1/logs/athletes/{athlete_id}/sessions", headers=admin_h
    )
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_athlete_cannot_list_another_athletes_sessions(
    client: AsyncClient, trainer_and_athlete
):
    ctx = trainer_and_athlete
    ath_h = ctx["ath_headers"]
    athlete_id = ctx["athlete_id"]

    resp = await client.get(
        f"/api/v1/logs/athletes/{athlete_id}/sessions", headers=ath_h
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_trainer_cannot_see_athlete_from_different_org(client: AsyncClient):
    # Separate gym — its athlete should be invisible to the first gym's trainer
    org1 = await _make_org(client, "Gym A")
    org2 = await _make_org(client, "Gym B")
    foreign_athlete_id = await _register(client, org2, _ue("foreign"), role="athlete")
    tr1_email = _ue("trainer1")
    await _register(client, org1, tr1_email, role="trainer")
    trainer_h = await _login(client, tr1_email)

    resp = await client.get(
        f"/api/v1/logs/athletes/{foreign_athlete_id}/sessions", headers=trainer_h
    )
    assert resp.status_code == 403


# ── stats ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trainer_can_get_athlete_stats(client: AsyncClient, trainer_and_athlete):
    ctx = trainer_and_athlete
    ath_h, trainer_h = ctx["ath_headers"], ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    await _start_and_finish_session(client, ath_h)

    resp = await client.get(
        f"/api/v1/logs/athletes/{athlete_id}/sessions/stats", headers=trainer_h
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "total_sessions" in data
    assert data["total_sessions"] >= 1


# ── weekly volume ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trainer_can_get_athlete_weekly_volume(client: AsyncClient, trainer_and_athlete):
    ctx = trainer_and_athlete
    ath_h, trainer_h = ctx["ath_headers"], ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    await _start_and_finish_session(client, ath_h)

    resp = await client.get(
        f"/api/v1/logs/athletes/{athlete_id}/sessions/volume-over-time",
        params={"weeks": 4},
        headers=trainer_h,
    )
    assert resp.status_code == 200
    assert "points" in resp.json()


# ── exercise history ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trainer_can_get_athlete_exercise_history(client: AsyncClient, trainer_and_athlete):
    ctx = trainer_and_athlete
    ath_h, trainer_h = ctx["ath_headers"], ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    # Create a global exercise (uses the fixture's gym_admin token)
    admin_h = ctx["admin_headers"]
    ex_resp = await client.post(
        "/api/v1/training/exercises",
        json={
            "name": "Squat", "muscle_group": "quads", "equipment": "barbell",
            "movement_pattern": "squat", "is_bilateral": True, "is_global": True,
            "aliases": [], "secondary_muscles": [],
        },
        headers=admin_h,
    )
    assert ex_resp.status_code == 201
    exercise_id = ex_resp.json()["id"]

    # Start session, add exercise, add set, finish
    sess_r = await client.post("/api/v1/logs/sessions", json={"mode": "on_the_fly"}, headers=ath_h)
    sid = sess_r.json()["id"]
    ex_log_r = await client.post(
        f"/api/v1/logs/sessions/{sid}/exercises",
        json={"exercise_id": exercise_id},
        headers=ath_h,
    )
    ex_log_id = ex_log_r.json()["id"]
    await client.post(
        f"/api/v1/logs/sessions/{sid}/exercises/{ex_log_id}/sets",
        json={"set_type": "working", "weight_kg": 100.0, "reps": 5, "counts_volume": True},
        headers=ath_h,
    )
    await client.patch(f"/api/v1/logs/sessions/{sid}/finish", json={}, headers=ath_h)

    resp = await client.get(
        f"/api/v1/logs/athletes/{athlete_id}/exercises/{exercise_id}/history",
        headers=trainer_h,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "points" in data
    assert len(data["points"]) >= 1
    assert data["points"][0]["best_weight_kg"] == 100.0


# ── trainer session management ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trainer_can_start_session_for_athlete(client: AsyncClient, trainer_and_athlete):
    ctx = trainer_and_athlete
    trainer_h = ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    resp = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=trainer_h,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["athlete_id"] == athlete_id
    assert data["finished_at"] is None


@pytest.mark.asyncio
async def test_trainer_can_get_athlete_active_session(client: AsyncClient, trainer_and_athlete):
    ctx = trainer_and_athlete
    trainer_h = ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=trainer_h,
    )

    resp = await client.get(
        f"/api/v1/logs/athletes/{athlete_id}/sessions/active",
        headers=trainer_h,
    )
    assert resp.status_code == 200
    assert resp.json()["athlete_id"] == athlete_id
    assert resp.json()["finished_at"] is None


@pytest.mark.asyncio
async def test_trainer_get_athlete_active_returns_204_when_none(
    client: AsyncClient, trainer_and_athlete
):
    ctx = trainer_and_athlete
    trainer_h = ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    resp = await client.get(
        f"/api/v1/logs/athletes/{athlete_id}/sessions/active",
        headers=trainer_h,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_trainer_can_add_exercise_and_sets_to_athlete_session(
    client: AsyncClient, trainer_and_athlete
):
    ctx = trainer_and_athlete
    trainer_h = ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    sess_r = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=trainer_h,
    )
    session_id = sess_r.json()["id"]

    ex_r = await client.post(
        f"/api/v1/logs/sessions/{session_id}/exercises",
        json={"exercise_name_free": "Bench Press"},
        headers=trainer_h,
    )
    assert ex_r.status_code == 201
    exercise_id = ex_r.json()["id"]

    set_r = await client.post(
        f"/api/v1/logs/sessions/{session_id}/exercises/{exercise_id}/sets",
        json={"set_type": "working", "weight_kg": 80.0, "reps": 8},
        headers=trainer_h,
    )
    assert set_r.status_code == 201
    set_data = set_r.json()
    assert set_data["weight_kg"] == 80.0
    assert set_data["reps"] == 8


@pytest.mark.asyncio
async def test_trainer_can_finish_athlete_session(client: AsyncClient, trainer_and_athlete):
    ctx = trainer_and_athlete
    trainer_h = ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    sess_r = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=trainer_h,
    )
    session_id = sess_r.json()["id"]

    finish_r = await client.patch(
        f"/api/v1/logs/athletes/{athlete_id}/sessions/{session_id}/finish",
        json={"notes": "Great session", "perceived_difficulty": 7},
        headers=trainer_h,
    )
    assert finish_r.status_code == 200
    data = finish_r.json()
    assert data["finished_at"] is not None
    assert data["notes"] == "Great session"
    assert data["perceived_difficulty"] == 7
    assert data["athlete_id"] == athlete_id


@pytest.mark.asyncio
async def test_finished_session_appears_in_athlete_history(
    client: AsyncClient, trainer_and_athlete
):
    ctx = trainer_and_athlete
    trainer_h = ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    sess_r = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly", "name": "Trainer-led Push Day"},
        headers=trainer_h,
    )
    session_id = sess_r.json()["id"]

    ex_r = await client.post(
        f"/api/v1/logs/sessions/{session_id}/exercises",
        json={"exercise_name_free": "Squat"},
        headers=trainer_h,
    )
    ex_id = ex_r.json()["id"]
    await client.post(
        f"/api/v1/logs/sessions/{session_id}/exercises/{ex_id}/sets",
        json={"set_type": "working", "weight_kg": 100.0, "reps": 5},
        headers=trainer_h,
    )

    await client.patch(
        f"/api/v1/logs/athletes/{athlete_id}/sessions/{session_id}/finish",
        json={},
        headers=trainer_h,
    )

    history_r = await client.get(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        headers=trainer_h,
    )
    assert history_r.status_code == 200
    sessions = history_r.json()
    assert any(s["id"] == session_id for s in sessions)


@pytest.mark.asyncio
async def test_athlete_cannot_start_session_for_another_athlete(
    client: AsyncClient, trainer_and_athlete
):
    ctx = trainer_and_athlete
    ath_h = ctx["ath_headers"]
    athlete_id = ctx["athlete_id"]

    resp = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=ath_h,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_trainer_from_other_org_cannot_start_session_for_athlete(
    client: AsyncClient, trainer_and_athlete
):
    ctx = trainer_and_athlete
    athlete_id = ctx["athlete_id"]

    other_org = await _make_org(client, "Other Gym")
    other_trainer_email = _ue("other_trainer")
    await _register(client, other_org, other_trainer_email, role="trainer")
    other_h = await _login(client, other_trainer_email)

    resp = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=other_h,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_trainer_without_org_cannot_manage_athlete(client: AsyncClient):
    """Trainer token with no organization_id must be rejected at _ensure_access."""
    org_id = await _make_org(client, "Org With Athlete")
    ath_email = _ue("ath_noorg")
    athlete_id = await _register(client, org_id, ath_email, role="athlete")

    # Register a trainer in a different org — then manually create a token with
    # no org_id by registering without an org (no org_id in the request body).
    # The identity module allows registration without an org for trainers.
    orphan_trainer_email = _ue("orphan_trainer")
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": orphan_trainer_email, "password": "securepass", "role": "trainer"},
    )
    assert resp.status_code == 201
    orphan_h = await _login(client, orphan_trainer_email)

    resp = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=orphan_h,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_trainer_cannot_finish_athlete_session_via_generic_endpoint(
    client: AsyncClient, trainer_and_athlete
):
    """PATCH /sessions/{id}/finish is athlete-only; trainers must use the explicit endpoint."""
    ctx = trainer_and_athlete
    trainer_h = ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    sess_r = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=trainer_h,
    )
    session_id = sess_r.json()["id"]

    # Trainer trying to finish via the athlete-facing generic endpoint
    resp = await client.patch(
        f"/api/v1/logs/sessions/{session_id}/finish",
        json={},
        headers=trainer_h,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_trainer_cannot_start_duplicate_active_session_for_athlete(
    client: AsyncClient, trainer_and_athlete
):
    ctx = trainer_and_athlete
    trainer_h = ctx["trainer_headers"]
    athlete_id = ctx["athlete_id"]

    r1 = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=trainer_h,
    )
    assert r1.status_code == 201

    r2 = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=trainer_h,
    )
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_athlete_cannot_start_own_session_while_trainer_already_started_one(
    client: AsyncClient, trainer_and_athlete
):
    """Trainer starts first; athlete's own start attempt must return 409."""
    ctx = trainer_and_athlete
    trainer_h = ctx["trainer_headers"]
    ath_h = ctx["ath_headers"]
    athlete_id = ctx["athlete_id"]

    r1 = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=trainer_h,
    )
    assert r1.status_code == 201

    r2 = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "on_the_fly"},
        headers=ath_h,
    )
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_trainer_cannot_start_session_while_athlete_already_has_one_active(
    client: AsyncClient, trainer_and_athlete
):
    """Athlete starts first; trainer's start attempt must return 409."""
    ctx = trainer_and_athlete
    trainer_h = ctx["trainer_headers"]
    ath_h = ctx["ath_headers"]
    athlete_id = ctx["athlete_id"]

    r1 = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "on_the_fly"},
        headers=ath_h,
    )
    assert r1.status_code == 201

    r2 = await client.post(
        f"/api/v1/logs/athletes/{athlete_id}/sessions",
        json={"mode": "on_the_fly"},
        headers=trainer_h,
    )
    assert r2.status_code == 409
