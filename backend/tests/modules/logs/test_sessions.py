"""Integration tests for the logs module — workout sessions, exercises, and sets."""

import uuid

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_org(client: AsyncClient, name: str = "Test Gym") -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register(
    client: AsyncClient,
    org_id: str,
    email: str = "athlete@example.com",
    password: str = "securepass",
    role: str = "athlete",
) -> str:
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": email, "password": password, "role": role, "organization_id": org_id},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _login(client: AsyncClient, email: str, password: str = "securepass") -> str:
    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


async def _auth_headers(client: AsyncClient, email: str, password: str = "securepass") -> dict:
    token = await _login(client, email, password)
    return {"Authorization": f"Bearer {token}"}


async def _start_session(client: AsyncClient, headers: dict, **kwargs) -> dict:
    body = {"mode": "on_the_fly", **kwargs}
    resp = await client.post("/api/v1/logs/sessions", json=body, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def _add_exercise(
    client: AsyncClient,
    headers: dict,
    session_id: str,
    exercise_name: str = "Bench Press",
) -> dict:
    resp = await client.post(
        f"/api/v1/logs/sessions/{session_id}/exercises",
        json={"exercise_name_free": exercise_name},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def _add_set(
    client: AsyncClient,
    headers: dict,
    session_id: str,
    exercise_id: str,
    **kwargs,
) -> dict:
    body = {"weight_kg": 100.0, "reps": 5, **kwargs}
    resp = await client.post(
        f"/api/v1/logs/sessions/{session_id}/exercises/{exercise_id}/sets",
        json=body,
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_session(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Start Gym")
    await _register(client, org_id, email="start@test.com")
    headers = await _auth_headers(client, "start@test.com")

    resp = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "on_the_fly"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data
    assert data["mode"] == "on_the_fly"
    assert data["finished_at"] is None
    assert data["logged_exercises"] == []


@pytest.mark.asyncio
async def test_start_session_auto_name_from_day_tag(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AutoName Gym")
    await _register(client, org_id, email="autoname@test.com")
    headers = await _auth_headers(client, "autoname@test.com")

    resp = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "on_the_fly", "day_tag": "push"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert "Push" in resp.json()["name"]


@pytest.mark.asyncio
async def test_start_session_explicit_name(client: AsyncClient) -> None:
    org_id = await _make_org(client, "ExplicitName Gym")
    await _register(client, org_id, email="explicit@test.com")
    headers = await _auth_headers(client, "explicit@test.com")

    resp = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "on_the_fly", "name": "My Heavy Day"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "My Heavy Day"


@pytest.mark.asyncio
async def test_start_second_session_returns_409(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Conflict Gym")
    await _register(client, org_id, email="conflict@test.com")
    headers = await _auth_headers(client, "conflict@test.com")

    await client.post("/api/v1/logs/sessions", json={"mode": "on_the_fly"}, headers=headers)
    resp = await client.post(
        "/api/v1/logs/sessions", json={"mode": "on_the_fly"}, headers=headers
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_get_active_session_none_returns_204(client: AsyncClient) -> None:
    org_id = await _make_org(client, "NoActive Gym")
    await _register(client, org_id, email="noactive@test.com")
    headers = await _auth_headers(client, "noactive@test.com")

    resp = await client.get("/api/v1/logs/sessions/active", headers=headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_get_active_session_returns_200_when_exists(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Active Gym")
    await _register(client, org_id, email="active@test.com")
    headers = await _auth_headers(client, "active@test.com")

    session = await _start_session(client, headers)
    resp = await client.get("/api/v1/logs/sessions/active", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == session["id"]


@pytest.mark.asyncio
async def test_get_session_by_id(client: AsyncClient) -> None:
    org_id = await _make_org(client, "GetById Gym")
    await _register(client, org_id, email="getbyid@test.com")
    headers = await _auth_headers(client, "getbyid@test.com")

    session = await _start_session(client, headers)
    resp = await client.get(f"/api/v1/logs/sessions/{session['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == session["id"]


@pytest.mark.asyncio
async def test_get_session_not_found_returns_404(client: AsyncClient) -> None:
    import uuid

    org_id = await _make_org(client, "NotFound Gym")
    await _register(client, org_id, email="notfound@test.com")
    headers = await _auth_headers(client, "notfound@test.com")

    resp = await client.get(
        f"/api/v1/logs/sessions/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_finish_session(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Finish Gym")
    await _register(client, org_id, email="finish@test.com")
    headers = await _auth_headers(client, "finish@test.com")

    session = await _start_session(client, headers)
    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}/finish",
        json={"notes": "Felt great", "perceived_difficulty": 7},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["finished_at"] is not None
    assert data["notes"] == "Felt great"
    assert data["perceived_difficulty"] == 7
    assert data["summary"] is not None
    assert data["summary"]["duration_seconds"] is not None


@pytest.mark.asyncio
async def test_finish_session_twice_returns_409(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DoubleFinish Gym")
    await _register(client, org_id, email="doublefinish@test.com")
    headers = await _auth_headers(client, "doublefinish@test.com")

    session = await _start_session(client, headers)
    await client.patch(
        f"/api/v1/logs/sessions/{session['id']}/finish",
        json={},
        headers=headers,
    )
    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}/finish",
        json={},
        headers=headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_sessions_only_returns_finished(client: AsyncClient) -> None:
    org_id = await _make_org(client, "List Gym")
    await _register(client, org_id, email="list@test.com")
    headers = await _auth_headers(client, "list@test.com")

    # Active session should NOT appear in list
    session = await _start_session(client, headers)

    resp = await client.get("/api/v1/logs/sessions", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []

    # After finishing it should appear
    await client.patch(
        f"/api/v1/logs/sessions/{session['id']}/finish", json={}, headers=headers
    )
    resp = await client.get("/api/v1/logs/sessions", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["id"] == session["id"]


@pytest.mark.asyncio
async def test_delete_session(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Delete Gym")
    await _register(client, org_id, email="delete@test.com")
    headers = await _auth_headers(client, "delete@test.com")

    session = await _start_session(client, headers)
    resp = await client.delete(
        f"/api/v1/logs/sessions/{session['id']}", headers=headers
    )
    assert resp.status_code == 204

    resp = await client.get(
        f"/api/v1/logs/sessions/{session['id']}", headers=headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/logs/sessions", json={"mode": "on_the_fly"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_solo_athlete_no_org_can_start_session(client: AsyncClient) -> None:
    """Athletes without an organization (solo users) can log sessions."""
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": "sololog@test.com", "password": "securepass", "role": "athlete"},
    )
    assert resp.status_code == 201
    assert resp.json()["organization_id"] is None

    headers = await _auth_headers(client, "sololog@test.com")

    resp = await client.post(
        "/api/v1/logs/sessions",
        json={"mode": "on_the_fly", "day_tag": "push"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["organization_id"] is None
    assert data["mode"] == "on_the_fly"
    assert "Push" in data["name"]


# ---------------------------------------------------------------------------
# Exercise log
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_exercise_free_form(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AddEx Gym")
    await _register(client, org_id, email="addex@test.com")
    headers = await _auth_headers(client, "addex@test.com")

    session = await _start_session(client, headers)
    resp = await client.post(
        f"/api/v1/logs/sessions/{session['id']}/exercises",
        json={"exercise_name_free": "Squat"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["exercise_name_free"] == "Squat"
    assert data["position"] == 1
    assert data["logged_sets"] == []


@pytest.mark.asyncio
async def test_add_exercise_requires_identifier_returns_422(client: AsyncClient) -> None:
    org_id = await _make_org(client, "NoId Gym")
    await _register(client, org_id, email="noid@test.com")
    headers = await _auth_headers(client, "noid@test.com")

    session = await _start_session(client, headers)
    resp = await client.post(
        f"/api/v1/logs/sessions/{session['id']}/exercises",
        json={},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_add_exercise_increments_position(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Position Gym")
    await _register(client, org_id, email="position@test.com")
    headers = await _auth_headers(client, "position@test.com")

    session = await _start_session(client, headers)
    ex1 = await _add_exercise(client, headers, session["id"], "Squat")
    ex2 = await _add_exercise(client, headers, session["id"], "Deadlift")
    assert ex1["position"] == 1
    assert ex2["position"] == 2


@pytest.mark.asyncio
async def test_add_exercise_to_finished_session_returns_409(client: AsyncClient) -> None:
    org_id = await _make_org(client, "FinishedEx Gym")
    await _register(client, org_id, email="finishedex@test.com")
    headers = await _auth_headers(client, "finishedex@test.com")

    session = await _start_session(client, headers)
    await client.patch(
        f"/api/v1/logs/sessions/{session['id']}/finish", json={}, headers=headers
    )
    resp = await client.post(
        f"/api/v1/logs/sessions/{session['id']}/exercises",
        json={"exercise_name_free": "Bench"},
        headers=headers,
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_delete_exercise(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelEx Gym")
    await _register(client, org_id, email="delex@test.com")
    headers = await _auth_headers(client, "delex@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "OHP")

    resp = await client.delete(
        f"/api/v1/logs/sessions/{session['id']}/exercises/{ex['id']}",
        headers=headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_exercise_not_found_returns_404(client: AsyncClient) -> None:
    import uuid

    org_id = await _make_org(client, "DelExNF Gym")
    await _register(client, org_id, email="delexnf@test.com")
    headers = await _auth_headers(client, "delexnf@test.com")

    session = await _start_session(client, headers)
    resp = await client.delete(
        f"/api/v1/logs/sessions/{session['id']}/exercises/{uuid.uuid4()}",
        headers=headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Set log
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_set_defaults(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AddSet Gym")
    await _register(client, org_id, email="addset@test.com")
    headers = await _auth_headers(client, "addset@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "Bench Press")

    resp = await client.post(
        f"/api/v1/logs/sessions/{session['id']}/exercises/{ex['id']}/sets",
        json={"weight_kg": 80.0, "reps": 8},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["weight_kg"] == 80.0
    assert data["reps"] == 8
    assert data["set_type"] == "working"
    assert data["counts_volume"] is True  # working sets count volume
    assert data["position"] == 1


@pytest.mark.asyncio
async def test_add_warm_up_set_does_not_count_volume(client: AsyncClient) -> None:
    org_id = await _make_org(client, "WarmUp Gym")
    await _register(client, org_id, email="warmup@test.com")
    headers = await _auth_headers(client, "warmup@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "Squat")

    resp = await client.post(
        f"/api/v1/logs/sessions/{session['id']}/exercises/{ex['id']}/sets",
        json={"weight_kg": 40.0, "reps": 10, "set_type": "warm_up"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["counts_volume"] is False


@pytest.mark.asyncio
async def test_add_set_explicit_counts_volume_override(client: AsyncClient) -> None:
    org_id = await _make_org(client, "CVOverride Gym")
    await _register(client, org_id, email="cvoverride@test.com")
    headers = await _auth_headers(client, "cvoverride@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "Press")

    resp = await client.post(
        f"/api/v1/logs/sessions/{session['id']}/exercises/{ex['id']}/sets",
        json={"weight_kg": 20.0, "reps": 20, "set_type": "warm_up", "counts_volume": True},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["counts_volume"] is True  # explicit override respected


@pytest.mark.asyncio
async def test_add_multiple_sets_increments_position(client: AsyncClient) -> None:
    org_id = await _make_org(client, "MultiSet Gym")
    await _register(client, org_id, email="multiset@test.com")
    headers = await _auth_headers(client, "multiset@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "Row")

    set1 = await _add_set(client, headers, session["id"], ex["id"], weight_kg=60.0, reps=10)
    set2 = await _add_set(client, headers, session["id"], ex["id"], weight_kg=65.0, reps=8)
    assert set1["position"] == 1
    assert set2["position"] == 2


@pytest.mark.asyncio
async def test_update_set(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateSet Gym")
    await _register(client, org_id, email="updateset@test.com")
    headers = await _auth_headers(client, "updateset@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "Deadlift")
    s = await _add_set(client, headers, session["id"], ex["id"], weight_kg=140.0, reps=5)

    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}/exercises/{ex['id']}/sets/{s['id']}",
        json={"weight_kg": 150.0, "rpe": 8.5},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["weight_kg"] == 150.0
    assert data["rpe"] == 8.5
    assert data["reps"] == 5  # unchanged


@pytest.mark.asyncio
async def test_update_set_type_recalculates_counts_volume(client: AsyncClient) -> None:
    org_id = await _make_org(client, "RecalcCV Gym")
    await _register(client, org_id, email="recalccv@test.com")
    headers = await _auth_headers(client, "recalccv@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "Curl")
    s = await _add_set(
        client, headers, session["id"], ex["id"], weight_kg=20.0, reps=12, set_type="working"
    )
    assert s["counts_volume"] is True

    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}/exercises/{ex['id']}/sets/{s['id']}",
        json={"set_type": "warm_up"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["counts_volume"] is False


@pytest.mark.asyncio
async def test_delete_set(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelSet Gym")
    await _register(client, org_id, email="delset@test.com")
    headers = await _auth_headers(client, "delset@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "Lat Pulldown")
    s = await _add_set(client, headers, session["id"], ex["id"])

    resp = await client.delete(
        f"/api/v1/logs/sessions/{session['id']}/exercises/{ex['id']}/sets/{s['id']}",
        headers=headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_set_from_finished_session_returns_409(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelSetFinished Gym")
    await _register(client, org_id, email="delsetfinished@test.com")
    headers = await _auth_headers(client, "delsetfinished@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "Cable Fly")
    s = await _add_set(client, headers, session["id"], ex["id"])

    await client.patch(
        f"/api/v1/logs/sessions/{session['id']}/finish", json={}, headers=headers
    )

    resp = await client.delete(
        f"/api/v1/logs/sessions/{session['id']}/exercises/{ex['id']}/sets/{s['id']}",
        headers=headers,
    )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Summary computation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_finish_session_computes_summary(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Summary Gym")
    await _register(client, org_id, email="summary@test.com")
    headers = await _auth_headers(client, "summary@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "Bench")

    # 3x working sets @ 100kg x 5 reps = 1500 kg volume
    await _add_set(client, headers, session["id"], ex["id"], weight_kg=100.0, reps=5)
    await _add_set(client, headers, session["id"], ex["id"], weight_kg=100.0, reps=5)
    await _add_set(client, headers, session["id"], ex["id"], weight_kg=100.0, reps=5)
    # 1x warm_up @ 60 x 10 = should NOT count (counts_volume=False for warm_up)
    await _add_set(
        client, headers, session["id"], ex["id"],
        weight_kg=60.0, reps=10, set_type="warm_up"
    )

    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}/finish", json={}, headers=headers
    )
    assert resp.status_code == 200
    summary = resp.json()["summary"]
    assert summary["total_volume_kg"] == 1500.0
    assert summary["working_sets_count"] == 3
    assert summary["exercises_count"] == 1
    assert summary["sets_by_type"]["working"] == 3
    assert summary["sets_by_type"]["warm_up"] == 1
    assert summary["duration_seconds"] is not None
    assert summary["duration_seconds"] >= 0


@pytest.mark.asyncio
async def test_session_response_includes_nested_exercises_and_sets(
    client: AsyncClient,
) -> None:
    org_id = await _make_org(client, "Nested Gym")
    await _register(client, org_id, email="nested@test.com")
    headers = await _auth_headers(client, "nested@test.com")

    session = await _start_session(client, headers)
    ex = await _add_exercise(client, headers, session["id"], "Press")
    await _add_set(client, headers, session["id"], ex["id"], weight_kg=70.0, reps=6)

    resp = await client.get(f"/api/v1/logs/sessions/{session['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["logged_exercises"]) == 1
    assert len(data["logged_exercises"][0]["logged_sets"]) == 1
    assert data["logged_exercises"][0]["logged_sets"][0]["weight_kg"] == 70.0


# ---------------------------------------------------------------------------
# Previous session (catalog exercise history)
# ---------------------------------------------------------------------------


async def _create_catalog_exercise(client: AsyncClient, headers: dict) -> str:
    resp = await client.post(
        "/api/v1/training/exercises",
        json={
            "name": "Barbell Bench Press",
            "muscle_group": "chest",
            "equipment": "barbell",
            "movement_pattern": "push",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_get_last_session_returns_204_when_no_history(client: AsyncClient) -> None:
    org_id = await _make_org(client, "LastSession204 Gym")
    await _register(client, org_id, email="lastsession204@test.com")
    headers = await _auth_headers(client, "lastsession204@test.com")

    # Use a random UUID — no history exists for this athlete/exercise pair
    random_exercise_id = str(uuid.uuid4())
    resp = await client.get(
        f"/api/v1/logs/exercises/catalog/{random_exercise_id}/last-session",
        headers=headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_get_last_session_returns_previous_sets(client: AsyncClient) -> None:
    org_id = await _make_org(client, "LastSession200 Gym")
    await _register(client, org_id, email="lastsession200@test.com")
    headers = await _auth_headers(client, "lastsession200@test.com")

    # Create a catalog exercise
    catalog_exercise_id = await _create_catalog_exercise(client, headers)

    # Session 1: finish it with two working sets of the catalog exercise
    session1 = await _start_session(client, headers, name="Previous Push Day")
    ex1 = await client.post(
        f"/api/v1/logs/sessions/{session1['id']}/exercises",
        json={"exercise_id": catalog_exercise_id},
        headers=headers,
    )
    assert ex1.status_code == 201
    ex1_id = ex1.json()["id"]

    await _add_set(client, headers, session1["id"], ex1_id, weight_kg=100.0, reps=5)
    await _add_set(client, headers, session1["id"], ex1_id, weight_kg=102.5, reps=4)

    await client.patch(
        f"/api/v1/logs/sessions/{session1['id']}/finish", json={}, headers=headers
    )

    # Start a new (active) session so we can call last-session mid-workout
    session2 = await _start_session(client, headers, name="Current Push Day")

    resp = await client.get(
        f"/api/v1/logs/exercises/catalog/{catalog_exercise_id}/last-session",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["session_name"] == "Previous Push Day"
    assert "session_date" in data

    sets = data["sets"]
    assert len(sets) == 2
    weights = {s["weight_kg"] for s in sets}
    assert weights == {100.0, 102.5}

    avg = data["average"]
    assert avg["sets_count"] == 2
    assert avg["volume_sets_count"] == 2  # both working sets count volume
    assert avg["weight_kg"] == 101.2  # round((100 + 102.5) / 2, 1) = banker's round 101.25→101.2
    assert avg["reps"] == 4.5  # round((5 + 4) / 2, 1)
    assert avg["rpe"] is None  # no RPE recorded
    assert avg["total_volume_kg"] == 910.0  # 100*5 + 102.5*4 = 500 + 410 = 910

    # Clean up the active session (avoid leaking state)
    await client.delete(f"/api/v1/logs/sessions/{session2['id']}", headers=headers)


@pytest.mark.asyncio
async def test_update_session_tag_returns_updated(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateTag Gym")
    await _register(client, org_id, email="updatetag@test.com")
    headers = await _auth_headers(client, "updatetag@test.com")
    session = await _start_session(client, headers)

    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}",
        json={"day_tag": "chest"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["day_tag"] == "chest"


@pytest.mark.asyncio
async def test_update_finished_session_returns_409(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateFinished Gym")
    await _register(client, org_id, email="updatefinished@test.com")
    headers = await _auth_headers(client, "updatefinished@test.com")
    session = await _start_session(client, headers)
    await client.patch(
        f"/api/v1/logs/sessions/{session['id']}/finish", json={}, headers=headers
    )

    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}",
        json={"day_tag": "back"},
        headers=headers,
    )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Link session to program day
# ---------------------------------------------------------------------------


async def _make_program_with_day(
    client: AsyncClient,
    headers: dict,
    *,
    program_name: str = "My Program",
    day_name: str = "Day 1",
    day_tag: str = "push",
) -> tuple[str, str]:
    """Create a program + one day and return (program_id, day_id)."""
    prog_resp = await client.post(
        "/api/v1/training/programs",
        json={"name": program_name},
        headers=headers,
    )
    assert prog_resp.status_code == 201, prog_resp.text
    program_id = prog_resp.json()["id"]

    day_resp = await client.post(
        f"/api/v1/training/programs/{program_id}/days",
        json={"name": day_name, "position": 1, "day_tag": day_tag},
        headers=headers,
    )
    assert day_resp.status_code == 201, day_resp.text
    return program_id, day_resp.json()["id"]


@pytest.mark.asyncio
async def test_link_session_to_program_day_sets_program_day_id(
    client: AsyncClient,
) -> None:
    org_id = await _make_org(client, "LinkDay Gym")
    await _register(client, org_id, email="linkday@test.com")
    headers = await _auth_headers(client, "linkday@test.com")

    _, day_id = await _make_program_with_day(client, headers)
    session = await _start_session(client, headers)

    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}",
        json={"program_day_id": day_id},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["program_day_id"] == day_id


@pytest.mark.asyncio
async def test_link_session_auto_syncs_day_tag_from_program_day(
    client: AsyncClient,
) -> None:
    org_id = await _make_org(client, "AutoSync Gym")
    await _register(client, org_id, email="autosync@test.com")
    headers = await _auth_headers(client, "autosync@test.com")

    _, day_id = await _make_program_with_day(client, headers, day_tag="legs")
    session = await _start_session(client, headers)

    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}",
        json={"program_day_id": day_id},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["program_day_id"] == day_id
    assert data["day_tag"] == "legs"  # auto-synced from program day


@pytest.mark.asyncio
async def test_link_session_explicit_day_tag_takes_priority(
    client: AsyncClient,
) -> None:
    org_id = await _make_org(client, "Priority Gym")
    await _register(client, org_id, email="priority@test.com")
    headers = await _auth_headers(client, "priority@test.com")

    _, day_id = await _make_program_with_day(client, headers, day_tag="push")
    session = await _start_session(client, headers)

    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}",
        json={"program_day_id": day_id, "day_tag": "chest"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["program_day_id"] == day_id
    assert data["day_tag"] == "chest"  # explicit day_tag wins over auto-sync


@pytest.mark.asyncio
async def test_link_session_nonexistent_day_returns_404(
    client: AsyncClient,
) -> None:
    org_id = await _make_org(client, "NoDay Gym")
    await _register(client, org_id, email="noday@test.com")
    headers = await _auth_headers(client, "noday@test.com")

    session = await _start_session(client, headers)

    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}",
        json={"program_day_id": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_link_session_to_other_org_program_day_returns_403(
    client: AsyncClient,
) -> None:
    # Org A — creates a program day
    org_a = await _make_org(client, "Org A Gym")
    await _register(client, org_a, email="orga@test.com", role="trainer")
    headers_a = await _auth_headers(client, "orga@test.com")
    _, day_id = await _make_program_with_day(client, headers_a)

    # Org B — athlete tries to link to Org A's day
    org_b = await _make_org(client, "Org B Gym")
    await _register(client, org_b, email="orgb@test.com")
    headers_b = await _auth_headers(client, "orgb@test.com")
    session = await _start_session(client, headers_b)

    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}",
        json={"program_day_id": day_id},
        headers=headers_b,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_unlink_session_from_program_day(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Unlink Gym")
    await _register(client, org_id, email="unlink@test.com")
    headers = await _auth_headers(client, "unlink@test.com")

    _, day_id = await _make_program_with_day(client, headers)
    session = await _start_session(client, headers)

    # First link it
    await client.patch(
        f"/api/v1/logs/sessions/{session['id']}",
        json={"program_day_id": day_id},
        headers=headers,
    )

    # Then unlink
    resp = await client.patch(
        f"/api/v1/logs/sessions/{session['id']}",
        json={"program_day_id": None},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["program_day_id"] is None
