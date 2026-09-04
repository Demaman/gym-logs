"""Tests for Train Together 1v1 battle sessions."""

import pytest
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────────────────────


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
    resp = await client.post(
        "/api/v1/identity/auth/login", json={"email": email, "password": pw}
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _start_session(client, token, name="Battle session"):
    resp = await client.post(
        "/api/v1/logs/sessions",
        json={"name": name, "mode": "on_the_fly"},
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _finish_session(client, token, session_id):
    resp = await client.patch(
        f"/api/v1/logs/sessions/{session_id}/finish",
        json={},
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_start_battle_creates_code(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 1")
    await _register(client, "ath1@bg1.com", "athlete", org)
    token = await _login(client, "ath1@bg1.com")
    session_id = await _start_session(client, token)

    resp = await client.post(
        f"/api/v1/logs/sessions/{session_id}/battle",
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["status"] == "waiting"
    assert len(data["battle_code"]) == 6
    assert data["initiator_session_id"] == session_id
    assert data["opponent_session_id"] is None


@pytest.mark.asyncio
async def test_cannot_start_battle_on_finished_session(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 2")
    await _register(client, "ath2@bg2.com", "athlete", org)
    token = await _login(client, "ath2@bg2.com")
    session_id = await _start_session(client, token)
    await _finish_session(client, token, session_id)

    resp = await client.post(
        f"/api/v1/logs/sessions/{session_id}/battle",
        headers=_auth(token),
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_join_battle_starts_session_and_links(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 3")
    await _register(client, "ath3a@bg3.com", "athlete", org)
    await _register(client, "ath3b@bg3.com", "athlete", org)
    token_a = await _login(client, "ath3a@bg3.com")
    token_b = await _login(client, "ath3b@bg3.com")

    session_a = await _start_session(client, token_a, "Chest day")
    battle_resp = await client.post(
        f"/api/v1/logs/sessions/{session_a}/battle",
        headers=_auth(token_a),
    )
    assert battle_resp.status_code == 201
    code = battle_resp.json()["battle_code"]

    join_resp = await client.post(
        f"/api/v1/logs/battles/{code}/join",
        json={"name": "Chest day", "mode": "on_the_fly"},
        headers=_auth(token_b),
    )
    assert join_resp.status_code == 201, join_resp.text
    data = join_resp.json()
    assert data["battle"]["status"] == "active"
    assert data["battle"]["opponent"] is not None
    assert data["session"]["id"] is not None


@pytest.mark.asyncio
async def test_cannot_join_own_battle(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 4")
    await _register(client, "ath4@bg4.com", "athlete", org)
    token = await _login(client, "ath4@bg4.com")
    session_id = await _start_session(client, token)

    battle_resp = await client.post(
        f"/api/v1/logs/sessions/{session_id}/battle",
        headers=_auth(token),
    )
    code = battle_resp.json()["battle_code"]

    join_resp = await client.post(
        f"/api/v1/logs/battles/{code}/join",
        json={"name": "Test", "mode": "on_the_fly"},
        headers=_auth(token),
    )
    assert join_resp.status_code == 403


@pytest.mark.asyncio
async def test_cannot_join_already_active_battle(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 5")
    await _register(client, "ath5a@bg5.com", "athlete", org)
    await _register(client, "ath5b@bg5.com", "athlete", org)
    await _register(client, "ath5c@bg5.com", "athlete", org)
    token_a = await _login(client, "ath5a@bg5.com")
    token_b = await _login(client, "ath5b@bg5.com")
    token_c = await _login(client, "ath5c@bg5.com")

    session_a = await _start_session(client, token_a)
    battle_resp = await client.post(
        f"/api/v1/logs/sessions/{session_a}/battle",
        headers=_auth(token_a),
    )
    code = battle_resp.json()["battle_code"]

    # B joins first
    join_b = await client.post(
        f"/api/v1/logs/battles/{code}/join",
        json={"name": "Test", "mode": "on_the_fly"},
        headers=_auth(token_b),
    )
    assert join_b.status_code == 201

    # C tries to join the same now-active battle
    join_c = await client.post(
        f"/api/v1/logs/battles/{code}/join",
        json={"name": "Test", "mode": "on_the_fly"},
        headers=_auth(token_c),
    )
    assert join_c.status_code == 409


@pytest.mark.asyncio
async def test_get_session_battle_returns_204_when_none(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 6")
    await _register(client, "ath6@bg6.com", "athlete", org)
    token = await _login(client, "ath6@bg6.com")
    session_id = await _start_session(client, token)

    resp = await client.get(
        f"/api/v1/logs/sessions/{session_id}/battle",
        headers=_auth(token),
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_get_battle_state_scores(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 7")
    await _register(client, "ath7a@bg7.com", "athlete", org)
    await _register(client, "ath7b@bg7.com", "athlete", org)
    token_a = await _login(client, "ath7a@bg7.com")
    token_b = await _login(client, "ath7b@bg7.com")

    session_a = await _start_session(client, token_a, "Pull day")
    battle_resp = await client.post(
        f"/api/v1/logs/sessions/{session_a}/battle",
        headers=_auth(token_a),
    )
    code = battle_resp.json()["battle_code"]
    battle_id = battle_resp.json()["id"]

    join_resp = await client.post(
        f"/api/v1/logs/battles/{code}/join",
        json={"name": "Pull day", "mode": "on_the_fly"},
        headers=_auth(token_b),
    )
    session_b = join_resp.json()["session"]["id"]

    # Add an exercise + set for athlete A
    ex_resp = await client.post(
        f"/api/v1/logs/sessions/{session_a}/exercises",
        json={"exercise_name_free": "Deadlift"},
        headers=_auth(token_a),
    )
    assert ex_resp.status_code == 201
    ex_id = ex_resp.json()["id"]
    await client.post(
        f"/api/v1/logs/sessions/{session_a}/exercises/{ex_id}/sets",
        json={"set_type": "working", "weight_kg": 100.0, "reps": 5},
        headers=_auth(token_a),
    )

    state_resp = await client.get(
        f"/api/v1/logs/battles/{battle_id}",
        headers=_auth(token_a),
    )
    assert state_resp.status_code == 200
    state = state_resp.json()
    assert state["status"] == "active"
    assert state["initiator"]["volume_kg"] == 500.0  # 100 * 5
    assert state["opponent"]["volume_kg"] == 0.0
    # Score = volume / bw^0.667 but no body weight → raw volume
    assert state["initiator"]["score"] == 500.0
    assert state["initiator"]["body_weight_kg"] is None


@pytest.mark.asyncio
async def test_battle_auto_finishes_when_both_sessions_done(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 8")
    await _register(client, "ath8a@bg8.com", "athlete", org)
    await _register(client, "ath8b@bg8.com", "athlete", org)
    token_a = await _login(client, "ath8a@bg8.com")
    token_b = await _login(client, "ath8b@bg8.com")

    session_a = await _start_session(client, token_a)
    battle_resp = await client.post(
        f"/api/v1/logs/sessions/{session_a}/battle",
        headers=_auth(token_a),
    )
    code = battle_resp.json()["battle_code"]
    battle_id = battle_resp.json()["id"]

    join_resp = await client.post(
        f"/api/v1/logs/battles/{code}/join",
        json={"name": "Test", "mode": "on_the_fly"},
        headers=_auth(token_b),
    )
    session_b = join_resp.json()["session"]["id"]

    # Finish both sessions
    await _finish_session(client, token_a, session_a)
    await _finish_session(client, token_b, session_b)

    state_resp = await client.get(
        f"/api/v1/logs/battles/{battle_id}",
        headers=_auth(token_a),
    )
    assert state_resp.status_code == 200
    assert state_resp.json()["status"] == "finished"
    assert state_resp.json()["finished_at"] is not None


@pytest.mark.asyncio
async def test_duplicate_battle_on_same_session_rejected(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 9")
    await _register(client, "ath9@bg9.com", "athlete", org)
    token = await _login(client, "ath9@bg9.com")
    session_id = await _start_session(client, token)

    resp1 = await client.post(
        f"/api/v1/logs/sessions/{session_id}/battle",
        headers=_auth(token),
    )
    assert resp1.status_code == 201

    resp2 = await client.post(
        f"/api/v1/logs/sessions/{session_id}/battle",
        headers=_auth(token),
    )
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_discard_session_cancels_waiting_battle(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 10")
    await _register(client, "ath10@bg10.com", "athlete", org)
    token = await _login(client, "ath10@bg10.com")
    session_id = await _start_session(client, token)

    battle_resp = await client.post(
        f"/api/v1/logs/sessions/{session_id}/battle",
        headers=_auth(token),
    )
    assert battle_resp.status_code == 201

    delete_resp = await client.delete(
        f"/api/v1/logs/sessions/{session_id}",
        headers=_auth(token),
    )
    assert delete_resp.status_code == 204


@pytest.mark.asyncio
async def test_discard_session_forfeits_active_battle(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 11")
    await _register(client, "ath11a@bg11.com", "athlete", org)
    await _register(client, "ath11b@bg11.com", "athlete", org)
    token_a = await _login(client, "ath11a@bg11.com")
    token_b = await _login(client, "ath11b@bg11.com")

    session_a = await _start_session(client, token_a)
    battle_resp = await client.post(
        f"/api/v1/logs/sessions/{session_a}/battle",
        headers=_auth(token_a),
    )
    code = battle_resp.json()["battle_code"]
    battle_id = battle_resp.json()["id"]

    await client.post(
        f"/api/v1/logs/battles/{code}/join",
        json={"name": "Battle session", "mode": "on_the_fly"},
        headers=_auth(token_b),
    )

    # Discarding forfeits the battle — session and battle row are both removed
    delete_resp = await client.delete(
        f"/api/v1/logs/sessions/{session_a}",
        headers=_auth(token_a),
    )
    assert delete_resp.status_code == 204

    # Battle is gone; opponent can still start a new session
    state_resp = await client.get(
        f"/api/v1/logs/battles/{battle_id}",
        headers=_auth(token_b),
    )
    assert state_resp.status_code == 404


@pytest.mark.asyncio
async def test_list_battles_empty(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 12")
    await _register(client, "ath12@bg12.com", "athlete", org)
    token = await _login(client, "ath12@bg12.com")

    resp = await client.get("/api/v1/logs/battles", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_battles_returns_finished(client: AsyncClient) -> None:
    org = await _make_org(client, "Battle Gym 13")
    await _register(client, "ath13a@bg13.com", "athlete", org)
    await _register(client, "ath13b@bg13.com", "athlete", org)
    token_a = await _login(client, "ath13a@bg13.com")
    token_b = await _login(client, "ath13b@bg13.com")

    session_a = await _start_session(client, token_a, "List test A")
    battle_resp = await client.post(
        f"/api/v1/logs/sessions/{session_a}/battle",
        headers=_auth(token_a),
    )
    assert battle_resp.status_code == 201
    code = battle_resp.json()["battle_code"]

    join_resp = await client.post(
        f"/api/v1/logs/battles/{code}/join",
        json={"name": "List test B", "mode": "on_the_fly"},
        headers=_auth(token_b),
    )
    assert join_resp.status_code == 201
    session_b = join_resp.json()["session"]["id"]

    # Finish both sessions so the battle resolves to "finished"
    await _finish_session(client, token_a, session_a)
    await _finish_session(client, token_b, session_b)

    resp = await client.get("/api/v1/logs/battles", headers=_auth(token_a))
    assert resp.status_code == 200
    battles = resp.json()
    assert len(battles) == 1
    assert battles[0]["status"] == "finished"


@pytest.mark.asyncio
async def test_get_battle_state_by_non_participant_returns_403(client: AsyncClient) -> None:
    """A third user who is not in the battle cannot read its state."""
    org = await _make_org(client, "Battle Gym 14")
    await _register(client, "ath14a@bg14.com", "athlete", org)
    await _register(client, "ath14b@bg14.com", "athlete", org)
    await _register(client, "ath14c@bg14.com", "athlete", org)
    token_a = await _login(client, "ath14a@bg14.com")
    token_b = await _login(client, "ath14b@bg14.com")
    token_c = await _login(client, "ath14c@bg14.com")

    session_a = await _start_session(client, token_a, "Sec test A")
    battle_resp = await client.post(
        f"/api/v1/logs/sessions/{session_a}/battle",
        headers=_auth(token_a),
    )
    assert battle_resp.status_code == 201
    code = battle_resp.json()["battle_code"]
    battle_id = battle_resp.json()["id"]

    join_resp = await client.post(
        f"/api/v1/logs/battles/{code}/join",
        json={"name": "Sec test B", "mode": "on_the_fly"},
        headers=_auth(token_b),
    )
    assert join_resp.status_code == 201

    # participant A and B can read the battle
    assert (await client.get(f"/api/v1/logs/battles/{battle_id}", headers=_auth(token_a))).status_code == 200
    assert (await client.get(f"/api/v1/logs/battles/{battle_id}", headers=_auth(token_b))).status_code == 200

    # uninvolved user C gets 403
    resp_c = await client.get(f"/api/v1/logs/battles/{battle_id}", headers=_auth(token_c))
    assert resp_c.status_code == 403


@pytest.mark.asyncio
async def test_get_session_battle_foreign_session_returns_404(client: AsyncClient) -> None:
    """A user cannot look up another user's session battle."""
    org = await _make_org(client, "Battle Gym 15")
    await _register(client, "ath15a@bg15.com", "athlete", org)
    await _register(client, "ath15b@bg15.com", "athlete", org)
    token_a = await _login(client, "ath15a@bg15.com")
    token_b = await _login(client, "ath15b@bg15.com")

    session_a = await _start_session(client, token_a, "Ownership test A")
    await client.post(f"/api/v1/logs/sessions/{session_a}/battle", headers=_auth(token_a))

    # user B tries to look up A's session battle → 404
    resp = await client.get(
        f"/api/v1/logs/sessions/{session_a}/battle",
        headers=_auth(token_b),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_exercises_hidden_during_active_battle(client: AsyncClient) -> None:
    """While both sides are still active, neither participant sees the exercise breakdown."""
    org = await _make_org(client, "Battle Gym 16")
    await _register(client, "ath16a@bg16.com", "athlete", org)
    await _register(client, "ath16b@bg16.com", "athlete", org)
    token_a = await _login(client, "ath16a@bg16.com")
    token_b = await _login(client, "ath16b@bg16.com")

    session_a = await _start_session(client, token_a, "Active battle A")
    battle_resp = await client.post(
        f"/api/v1/logs/sessions/{session_a}/battle",
        headers=_auth(token_a),
    )
    assert battle_resp.status_code == 201
    code = battle_resp.json()["battle_code"]
    battle_id = battle_resp.json()["id"]

    join_resp = await client.post(
        f"/api/v1/logs/battles/{code}/join",
        json={"name": "Active battle B", "mode": "on_the_fly"},
        headers=_auth(token_b),
    )
    assert join_resp.status_code == 201

    # Neither side has finished — exercises must be empty for both participants
    state_resp = await client.get(f"/api/v1/logs/battles/{battle_id}", headers=_auth(token_a))
    assert state_resp.status_code == 200
    state = state_resp.json()
    assert state["status"] == "active"
    assert state["initiator"]["exercises"] == []
    assert state["opponent"]["exercises"] == []
