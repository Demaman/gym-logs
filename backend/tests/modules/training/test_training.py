"""Integration tests for the training module — exercises, programs, days, and sets."""

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
    org_id: str | None,
    email: str = "user@example.com",
    password: str = "securepass",
    role: str = "trainer",
) -> str:
    body: dict = {"email": email, "password": password, "role": role}
    if org_id is not None:
        body["organization_id"] = org_id
    resp = await client.post("/api/v1/identity/auth/register", json=body)
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


async def _create_exercise(
    client: AsyncClient,
    headers: dict,
    name: str = "Bench Press",
    muscle_group: str = "chest",
    equipment: str = "barbell",
    movement_pattern: str = "push",
) -> dict:
    resp = await client.post(
        "/api/v1/training/exercises",
        json={
            "name": name,
            "muscle_group": muscle_group,
            "equipment": equipment,
            "movement_pattern": movement_pattern,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def _create_program(
    client: AsyncClient,
    headers: dict,
    name: str = "My Program",
    mode: str = "on_the_fly",
    **kwargs,
) -> dict:
    body = {"name": name, "mode": mode, **kwargs}
    resp = await client.post("/api/v1/training/programs", json=body, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def _add_day(
    client: AsyncClient,
    headers: dict,
    program_id: str,
    name: str = "Push Day",
    position: int = 1,
    day_tag: str = "push",
) -> dict:
    resp = await client.post(
        f"/api/v1/training/programs/{program_id}/days",
        json={"name": name, "position": position, "day_tag": day_tag},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def _add_exercise_to_day(
    client: AsyncClient,
    headers: dict,
    day_id: str,
    exercise_id: str,
    position: int = 1,
) -> dict:
    resp = await client.post(
        f"/api/v1/training/days/{day_id}/exercises",
        json={"exercise_id": exercise_id, "position": position},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def _add_prescribed_set(
    client: AsyncClient,
    headers: dict,
    program_exercise_id: str,
    position: int = 1,
    set_type: str = "working",
    rep_min: int = 8,
    rep_max: int = 12,
) -> dict:
    resp = await client.post(
        f"/api/v1/training/program-exercises/{program_exercise_id}/sets",
        json={
            "position": position,
            "set_type": set_type,
            "rep_min": rep_min,
            "rep_max": rep_max,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Exercise CRUD
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_exercise(client: AsyncClient) -> None:
    org_id = await _make_org(client, "CreateEx Gym")
    await _register(client, org_id, email="createex@test.com", role="trainer")
    headers = await _auth_headers(client, "createex@test.com")

    resp = await client.post(
        "/api/v1/training/exercises",
        json={
            "name": "Squat",
            "muscle_group": "quads",
            "equipment": "barbell",
            "movement_pattern": "squat",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Squat"
    assert data["muscle_group"] == "quads"
    assert data["equipment"] == "barbell"
    assert data["movement_pattern"] == "squat"
    assert "id" in data
    assert data["is_global"] is False


@pytest.mark.asyncio
async def test_create_exercise_requires_auth(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/training/exercises",
        json={
            "name": "Squat",
            "muscle_group": "quads",
            "equipment": "barbell",
            "movement_pattern": "squat",
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_exercise_invalid_muscle_group_returns_422(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Invalid422 Gym")
    await _register(client, org_id, email="invalid422@test.com", role="trainer")
    headers = await _auth_headers(client, "invalid422@test.com")

    resp = await client.post(
        "/api/v1/training/exercises",
        json={
            "name": "Unknown",
            "muscle_group": "not_a_muscle",
            "equipment": "barbell",
            "movement_pattern": "squat",
        },
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_exercise(client: AsyncClient) -> None:
    org_id = await _make_org(client, "GetEx Gym")
    await _register(client, org_id, email="getex@test.com", role="trainer")
    headers = await _auth_headers(client, "getex@test.com")

    ex = await _create_exercise(client, headers, name="Deadlift", muscle_group="hamstrings", movement_pattern="hinge")

    resp = await client.get(f"/api/v1/training/exercises/{ex['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == ex["id"]
    assert resp.json()["name"] == "Deadlift"


@pytest.mark.asyncio
async def test_get_exercise_not_found_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "GetExNF Gym")
    await _register(client, org_id, email="getexnf@test.com", role="trainer")
    headers = await _auth_headers(client, "getexnf@test.com")

    resp = await client.get(
        f"/api/v1/training/exercises/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_search_exercises_returns_list(client: AsyncClient) -> None:
    org_id = await _make_org(client, "SearchEx Gym")
    await _register(client, org_id, email="searchex@test.com", role="trainer")
    headers = await _auth_headers(client, "searchex@test.com")

    # Create a couple of exercises to ensure the list is non-empty
    await _create_exercise(client, headers, name="OHP", muscle_group="shoulders", movement_pattern="push")
    await _create_exercise(client, headers, name="Pull Up", muscle_group="back", equipment="bodyweight", movement_pattern="pull")

    resp = await client.get("/api/v1/training/exercises", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_search_exercises_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/training/exercises")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_search_exercises_filter_by_muscle_group(client: AsyncClient) -> None:
    org_id = await _make_org(client, "FilterMG Gym")
    await _register(client, org_id, email="filtermg@test.com", role="trainer")
    headers = await _auth_headers(client, "filtermg@test.com")

    await _create_exercise(client, headers, name="Chest Fly", muscle_group="chest", movement_pattern="push")
    await _create_exercise(client, headers, name="Leg Press", muscle_group="quads", equipment="machine", movement_pattern="squat")

    resp = await client.get(
        "/api/v1/training/exercises",
        params={"muscle_group": "chest"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert all(e["muscle_group"] == "chest" for e in data)


@pytest.mark.asyncio
async def test_search_exercises_filter_by_query(client: AsyncClient) -> None:
    org_id = await _make_org(client, "SearchQ Gym")
    await _register(client, org_id, email="searchq@test.com", role="trainer")
    headers = await _auth_headers(client, "searchq@test.com")

    await _create_exercise(client, headers, name="Barbell Row", muscle_group="back", movement_pattern="pull")

    resp = await client.get(
        "/api/v1/training/exercises",
        params={"query": "Barbell Row"},
        headers=headers,
    )
    assert resp.status_code == 200
    names = [e["name"] for e in resp.json()]
    assert "Barbell Row" in names


@pytest.mark.asyncio
async def test_search_exercises_filter_by_equipment(client: AsyncClient) -> None:
    org_id = await _make_org(client, "FilterEquip Gym")
    await _register(client, org_id, email="filterequip@test.com", role="trainer")
    headers = await _auth_headers(client, "filterequip@test.com")

    await _create_exercise(client, headers, name="KB Swing", muscle_group="glutes", equipment="kettlebell", movement_pattern="hinge")

    resp = await client.get(
        "/api/v1/training/exercises",
        params={"equipment": "kettlebell"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert all(e["equipment"] == "kettlebell" for e in data)


@pytest.mark.asyncio
async def test_search_exercises_limit_offset(client: AsyncClient) -> None:
    org_id = await _make_org(client, "LimitOffset Gym")
    await _register(client, org_id, email="limitoffset@test.com", role="trainer")
    headers = await _auth_headers(client, "limitoffset@test.com")

    # Create 5 exercises
    for i in range(5):
        await _create_exercise(
            client, headers,
            name=f"Exercise {i}",
            muscle_group="chest",
            movement_pattern="push",
        )

    resp1 = await client.get(
        "/api/v1/training/exercises",
        params={"limit": 2, "offset": 0},
        headers=headers,
    )
    assert resp1.status_code == 200
    assert len(resp1.json()) <= 2

    resp2 = await client.get(
        "/api/v1/training/exercises",
        params={"limit": 2, "offset": 2},
        headers=headers,
    )
    assert resp2.status_code == 200
    # Should not overlap with first page
    ids1 = {e["id"] for e in resp1.json()}
    ids2 = {e["id"] for e in resp2.json()}
    assert ids1.isdisjoint(ids2)


@pytest.mark.asyncio
async def test_update_exercise_by_creator(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateEx Gym")
    await _register(client, org_id, email="updateex@test.com", role="trainer")
    headers = await _auth_headers(client, "updateex@test.com")

    ex = await _create_exercise(client, headers, name="Incline Press", muscle_group="chest", movement_pattern="push")

    resp = await client.put(
        f"/api/v1/training/exercises/{ex['id']}",
        json={"name": "Incline Bench Press", "notes": "Use 30 degree incline"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Incline Bench Press"
    assert data["notes"] == "Use 30 degree incline"


@pytest.mark.asyncio
async def test_update_exercise_not_found_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateExNF Gym")
    await _register(client, org_id, email="updateexnf@test.com", role="trainer")
    headers = await _auth_headers(client, "updateexnf@test.com")

    resp = await client.put(
        f"/api/v1/training/exercises/{uuid.uuid4()}",
        json={"name": "Nope"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_exercise_by_non_creator_non_admin_returns_403(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateEx403 Gym")
    await _register(client, org_id, email="owner403@test.com", role="trainer")
    await _register(client, org_id, email="other403@test.com", role="trainer")

    owner_headers = await _auth_headers(client, "owner403@test.com")
    other_headers = await _auth_headers(client, "other403@test.com")

    ex = await _create_exercise(client, owner_headers, name="Cable Fly", muscle_group="chest", movement_pattern="push", equipment="cable")

    resp = await client.put(
        f"/api/v1/training/exercises/{ex['id']}",
        json={"name": "Sneaky Rename"},
        headers=other_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_update_exercise_by_gym_admin_succeeds(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AdminUpdateEx Gym")
    await _register(client, org_id, email="traineradmin@test.com", role="trainer")
    await _register(client, org_id, email="adminupdate@test.com", role="gym_admin")

    trainer_headers = await _auth_headers(client, "traineradmin@test.com")
    admin_headers = await _auth_headers(client, "adminupdate@test.com")

    ex = await _create_exercise(client, trainer_headers, name="Machine Row", muscle_group="back", equipment="machine", movement_pattern="pull")

    resp = await client.put(
        f"/api/v1/training/exercises/{ex['id']}",
        json={"notes": "Admin override note"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["notes"] == "Admin override note"


@pytest.mark.asyncio
async def test_delete_exercise_by_creator(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelExCre Gym")
    await _register(client, org_id, email="delexcre@test.com", role="trainer")
    headers = await _auth_headers(client, "delexcre@test.com")

    ex = await _create_exercise(client, headers, name="Dip", muscle_group="triceps", equipment="bodyweight", movement_pattern="push")

    resp = await client.delete(f"/api/v1/training/exercises/{ex['id']}", headers=headers)
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(f"/api/v1/training/exercises/{ex['id']}", headers=headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_exercise_not_found_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelExNF2 Gym")
    await _register(client, org_id, email="delexnf2@test.com", role="trainer")
    headers = await _auth_headers(client, "delexnf2@test.com")

    resp = await client.delete(
        f"/api/v1/training/exercises/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_exercise_by_non_creator_non_admin_returns_403(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelEx403 Gym")
    await _register(client, org_id, email="delex403owner@test.com", role="trainer")
    await _register(client, org_id, email="delex403other@test.com", role="trainer")

    owner_headers = await _auth_headers(client, "delex403owner@test.com")
    other_headers = await _auth_headers(client, "delex403other@test.com")

    ex = await _create_exercise(client, owner_headers, name="Preacher Curl", muscle_group="biceps", movement_pattern="isolation")

    resp = await client.delete(
        f"/api/v1/training/exercises/{ex['id']}", headers=other_headers
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_exercise_org_isolation(client: AsyncClient) -> None:
    """Exercises created by org A should not be visible to org B via ID lookup (they still are,
    since get_exercise is not scoped, but create is org-scoped). Search results ARE scoped."""
    org_a = await _make_org(client, "OrgA Gym")
    org_b = await _make_org(client, "OrgB Gym")

    await _register(client, org_a, email="trainer_a@test.com", role="trainer")
    await _register(client, org_b, email="trainer_b@test.com", role="trainer")

    headers_a = await _auth_headers(client, "trainer_a@test.com")
    headers_b = await _auth_headers(client, "trainer_b@test.com")

    # Org A creates an exercise
    ex_a = await _create_exercise(client, headers_a, name="OrgA Exercise", muscle_group="chest", movement_pattern="push")

    # Org B search should not return org A's exercises (search is org-scoped)
    resp = await client.get(
        "/api/v1/training/exercises",
        params={"query": "OrgA Exercise"},
        headers=headers_b,
    )
    assert resp.status_code == 200
    ids = [e["id"] for e in resp.json()]
    assert ex_a["id"] not in ids


# ---------------------------------------------------------------------------
# Program CRUD
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_program(client: AsyncClient) -> None:
    org_id = await _make_org(client, "CreateProg Gym")
    await _register(client, org_id, email="createprog@test.com", role="trainer")
    headers = await _auth_headers(client, "createprog@test.com")

    resp = await client.post(
        "/api/v1/training/programs",
        json={"name": "Hypertrophy Block", "mode": "program_driven"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Hypertrophy Block"
    assert data["mode"] == "program_driven"
    assert data["is_active"] is True
    assert data["days"] == []
    assert "id" in data


@pytest.mark.asyncio
async def test_create_program_requires_auth(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/training/programs",
        json={"name": "No Auth Program"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_create_program_without_org_succeeds(client: AsyncClient) -> None:
    """Solo athletes (no org) can create personal programs — organization_id is nullable."""
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": "solonorg@test.com", "password": "securepass", "role": "athlete"},
    )
    assert resp.status_code == 201
    headers = await _auth_headers(client, "solonorg@test.com")

    resp = await client.post(
        "/api/v1/training/programs",
        json={"name": "Solo Program"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Solo Program"
    assert data["organization_id"] is None


@pytest.mark.asyncio
async def test_create_program_for_athlete_as_trainer(client: AsyncClient) -> None:
    org_id = await _make_org(client, "TrainerProg Gym")
    athlete_id = await _register(client, org_id, email="athlete_tp@test.com", role="athlete")
    await _register(client, org_id, email="trainer_tp@test.com", role="trainer")

    trainer_headers = await _auth_headers(client, "trainer_tp@test.com")

    resp = await client.post(
        "/api/v1/training/programs",
        json={"name": "Athlete Program", "athlete_id": athlete_id},
        headers=trainer_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["athlete_id"] == athlete_id


@pytest.mark.asyncio
async def test_create_program_for_other_athlete_as_athlete_returns_403(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AthleteProg403 Gym")
    other_athlete_id = await _register(client, org_id, email="otherath403@test.com", role="athlete")
    await _register(client, org_id, email="selfath403@test.com", role="athlete")

    self_headers = await _auth_headers(client, "selfath403@test.com")

    resp = await client.post(
        "/api/v1/training/programs",
        json={"name": "Sneaky Program", "athlete_id": other_athlete_id},
        headers=self_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_program(client: AsyncClient) -> None:
    org_id = await _make_org(client, "GetProg Gym")
    await _register(client, org_id, email="getprog@test.com", role="trainer")
    headers = await _auth_headers(client, "getprog@test.com")

    program = await _create_program(client, headers, name="Strength Block")

    resp = await client.get(f"/api/v1/training/programs/{program['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == program["id"]
    assert data["name"] == "Strength Block"
    assert "days" in data


@pytest.mark.asyncio
async def test_get_program_not_found_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "GetProgNF Gym")
    await _register(client, org_id, email="getprognf@test.com", role="trainer")
    headers = await _auth_headers(client, "getprognf@test.com")

    resp = await client.get(
        f"/api/v1/training/programs/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_program_cross_org_returns_404(client: AsyncClient) -> None:
    """A program from org A should not be visible to org B."""
    org_a = await _make_org(client, "OrgA Prog Gym")
    org_b = await _make_org(client, "OrgB Prog Gym")

    await _register(client, org_a, email="trainerpa@test.com", role="trainer")
    await _register(client, org_b, email="trainerpb@test.com", role="trainer")

    headers_a = await _auth_headers(client, "trainerpa@test.com")
    headers_b = await _auth_headers(client, "trainerpb@test.com")

    program_a = await _create_program(client, headers_a, name="Org A Program")

    resp = await client.get(
        f"/api/v1/training/programs/{program_a['id']}", headers=headers_b
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_programs(client: AsyncClient) -> None:
    org_id = await _make_org(client, "ListProg Gym")
    await _register(client, org_id, email="listprog@test.com", role="trainer")
    headers = await _auth_headers(client, "listprog@test.com")

    await _create_program(client, headers, name="Program A")
    await _create_program(client, headers, name="Program B")

    resp = await client.get("/api/v1/training/programs", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    names = [p["name"] for p in data]
    assert "Program A" in names
    assert "Program B" in names


@pytest.mark.asyncio
async def test_list_programs_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/training/programs")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_gym_admin_sees_all_org_programs(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AdminList Gym")
    athlete_id = await _register(client, org_id, email="athlete_al@test.com", role="athlete")
    await _register(client, org_id, email="trainer_al@test.com", role="trainer")
    await _register(client, org_id, email="admin_al@test.com", role="gym_admin")

    trainer_headers = await _auth_headers(client, "trainer_al@test.com")
    admin_headers = await _auth_headers(client, "admin_al@test.com")

    # Trainer creates program for athlete
    await client.post(
        "/api/v1/training/programs",
        json={"name": "Athlete Plan", "athlete_id": athlete_id},
        headers=trainer_headers,
    )

    # Admin should see all org programs
    resp = await client.get("/api/v1/training/programs", headers=admin_headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "Athlete Plan" in names


@pytest.mark.asyncio
async def test_update_program(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateProg Gym")
    await _register(client, org_id, email="updateprog@test.com", role="trainer")
    headers = await _auth_headers(client, "updateprog@test.com")

    program = await _create_program(client, headers, name="Old Name")

    resp = await client.put(
        f"/api/v1/training/programs/{program['id']}",
        json={"name": "New Name", "description": "Updated description"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["description"] == "Updated description"


@pytest.mark.asyncio
async def test_update_program_not_found_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateProgNF Gym")
    await _register(client, org_id, email="updateprognf@test.com", role="trainer")
    headers = await _auth_headers(client, "updateprognf@test.com")

    resp = await client.put(
        f"/api/v1/training/programs/{uuid.uuid4()}",
        json={"name": "Nope"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_program_by_non_creator_returns_403(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateProg403 Gym")
    await _register(client, org_id, email="prog403owner@test.com", role="trainer")
    await _register(client, org_id, email="prog403other@test.com", role="trainer")

    owner_headers = await _auth_headers(client, "prog403owner@test.com")
    other_headers = await _auth_headers(client, "prog403other@test.com")

    program = await _create_program(client, owner_headers, name="Owner's Program")

    resp = await client.put(
        f"/api/v1/training/programs/{program['id']}",
        json={"name": "Hijacked"},
        headers=other_headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_delete_program(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelProg Gym")
    await _register(client, org_id, email="delprog@test.com", role="trainer")
    headers = await _auth_headers(client, "delprog@test.com")

    program = await _create_program(client, headers, name="To Delete")

    resp = await client.delete(f"/api/v1/training/programs/{program['id']}", headers=headers)
    assert resp.status_code == 204

    get_resp = await client.get(f"/api/v1/training/programs/{program['id']}", headers=headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_program_not_found_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelProgNF Gym")
    await _register(client, org_id, email="delprognf@test.com", role="trainer")
    headers = await _auth_headers(client, "delprognf@test.com")

    resp = await client.delete(
        f"/api/v1/training/programs/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_program_by_non_creator_returns_403(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelProg403 Gym")
    await _register(client, org_id, email="delp403owner@test.com", role="trainer")
    await _register(client, org_id, email="delp403other@test.com", role="trainer")

    owner_headers = await _auth_headers(client, "delp403owner@test.com")
    other_headers = await _auth_headers(client, "delp403other@test.com")

    program = await _create_program(client, owner_headers, name="Owner Program")

    resp = await client.delete(
        f"/api/v1/training/programs/{program['id']}", headers=other_headers
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Program days
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_program_day(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AddDay Gym")
    await _register(client, org_id, email="addday@test.com", role="trainer")
    headers = await _auth_headers(client, "addday@test.com")

    program = await _create_program(client, headers, name="Day Test Program")

    resp = await client.post(
        f"/api/v1/training/programs/{program['id']}/days",
        json={"name": "Push Day", "position": 1, "day_tag": "push"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Push Day"
    assert data["position"] == 1
    assert data["day_tag"] == "push"
    assert data["program_id"] == program["id"]
    assert data["exercises"] == []


@pytest.mark.asyncio
async def test_add_program_day_all_valid_tags(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AllTags Gym")
    await _register(client, org_id, email="alltags@test.com", role="trainer")
    headers = await _auth_headers(client, "alltags@test.com")

    program = await _create_program(client, headers, name="Tag Test Program")
    valid_tags = ["push", "pull", "legs", "upper", "lower", "full_body", "cardio",
                  "custom", "chest", "back", "shoulders", "arms", "glutes", "core"]

    for i, tag in enumerate(valid_tags):
        resp = await client.post(
            f"/api/v1/training/programs/{program['id']}/days",
            json={"name": f"{tag} Day", "position": i + 1, "day_tag": tag},
            headers=headers,
        )
        assert resp.status_code == 201, f"tag '{tag}' should be valid"
        assert resp.json()["day_tag"] == tag


@pytest.mark.asyncio
async def test_add_program_day_invalid_tag_returns_422(client: AsyncClient) -> None:
    org_id = await _make_org(client, "BadTag Gym")
    await _register(client, org_id, email="badtag@test.com", role="trainer")
    headers = await _auth_headers(client, "badtag@test.com")

    program = await _create_program(client, headers, name="Bad Tag Program")

    resp = await client.post(
        f"/api/v1/training/programs/{program['id']}/days",
        json={"name": "Invalid", "position": 1, "day_tag": "not_a_valid_tag"},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_add_day_to_nonexistent_program_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DayProgNF Gym")
    await _register(client, org_id, email="dayprognf@test.com", role="trainer")
    headers = await _auth_headers(client, "dayprognf@test.com")

    resp = await client.post(
        f"/api/v1/training/programs/{uuid.uuid4()}/days",
        json={"name": "Orphan Day", "position": 1, "day_tag": "push"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_program_day(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateDay Gym")
    await _register(client, org_id, email="updateday@test.com", role="trainer")
    headers = await _auth_headers(client, "updateday@test.com")

    program = await _create_program(client, headers, name="Update Day Program")
    day = await _add_day(client, headers, program["id"], name="Old Day", day_tag="push")

    resp = await client.put(
        f"/api/v1/training/days/{day['id']}",
        json={"name": "New Day Name", "day_tag": "pull"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Day Name"
    assert data["day_tag"] == "pull"


@pytest.mark.asyncio
async def test_update_program_day_not_found_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateDayNF Gym")
    await _register(client, org_id, email="updatedaynf@test.com", role="trainer")
    headers = await _auth_headers(client, "updatedaynf@test.com")

    resp = await client.put(
        f"/api/v1/training/days/{uuid.uuid4()}",
        json={"name": "Ghost Day"},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_program_day(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelDay Gym")
    await _register(client, org_id, email="delday@test.com", role="trainer")
    headers = await _auth_headers(client, "delday@test.com")

    program = await _create_program(client, headers, name="Delete Day Program")
    day = await _add_day(client, headers, program["id"])

    resp = await client.delete(f"/api/v1/training/days/{day['id']}", headers=headers)
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_program_day_not_found_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelDayNF Gym")
    await _register(client, org_id, email="deldaynf@test.com", role="trainer")
    headers = await _auth_headers(client, "deldaynf@test.com")

    resp = await client.delete(
        f"/api/v1/training/days/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_program_includes_nested_days_and_exercises(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Nested Prog Gym")
    await _register(client, org_id, email="nestedprog@test.com", role="trainer")
    headers = await _auth_headers(client, "nestedprog@test.com")

    program = await _create_program(client, headers, name="Nested Program")
    day = await _add_day(client, headers, program["id"], name="Legs Day", day_tag="legs")

    ex = await _create_exercise(
        client, headers, name="Leg Press", muscle_group="quads", equipment="machine", movement_pattern="squat"
    )
    await _add_exercise_to_day(client, headers, day["id"], ex["id"])

    resp = await client.get(f"/api/v1/training/programs/{program['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["days"]) == 1
    assert data["days"][0]["name"] == "Legs Day"
    assert len(data["days"][0]["exercises"]) == 1
    assert data["days"][0]["exercises"][0]["exercise_id"] == ex["id"]


# ---------------------------------------------------------------------------
# Program exercises (exercises within a day)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_exercise_to_day(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AddExDay Gym")
    await _register(client, org_id, email="addexday@test.com", role="trainer")
    headers = await _auth_headers(client, "addexday@test.com")

    program = await _create_program(client, headers, name="Add Ex Day Program")
    day = await _add_day(client, headers, program["id"])
    ex = await _create_exercise(client, headers, name="RDL", muscle_group="hamstrings", movement_pattern="hinge")

    resp = await client.post(
        f"/api/v1/training/days/{day['id']}/exercises",
        json={"exercise_id": ex["id"], "position": 1},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["exercise_id"] == ex["id"]
    assert data["position"] == 1
    assert data["program_day_id"] == day["id"]
    assert data["prescribed_sets"] == []


@pytest.mark.asyncio
async def test_add_exercise_to_day_with_notes(client: AsyncClient) -> None:
    org_id = await _make_org(client, "ExDayNotes Gym")
    await _register(client, org_id, email="exdaynotes@test.com", role="trainer")
    headers = await _auth_headers(client, "exdaynotes@test.com")

    program = await _create_program(client, headers, name="Notes Program")
    day = await _add_day(client, headers, program["id"])
    ex = await _create_exercise(client, headers, name="Curl", muscle_group="biceps", movement_pattern="isolation")

    resp = await client.post(
        f"/api/v1/training/days/{day['id']}/exercises",
        json={"exercise_id": ex["id"], "position": 1, "notes": "Focus on peak contraction"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["notes"] == "Focus on peak contraction"


@pytest.mark.asyncio
async def test_add_exercise_to_nonexistent_day_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "ExDayNF Gym")
    await _register(client, org_id, email="exdaynf@test.com", role="trainer")
    headers = await _auth_headers(client, "exdaynf@test.com")

    ex = await _create_exercise(client, headers, name="Rows", muscle_group="back", movement_pattern="pull")

    resp = await client.post(
        f"/api/v1/training/days/{uuid.uuid4()}/exercises",
        json={"exercise_id": ex["id"], "position": 1},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_exercise_from_day(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelExDay Gym")
    await _register(client, org_id, email="delexday@test.com", role="trainer")
    headers = await _auth_headers(client, "delexday@test.com")

    program = await _create_program(client, headers, name="Del Ex Day Program")
    day = await _add_day(client, headers, program["id"])
    ex = await _create_exercise(client, headers, name="Lat Pulldown", muscle_group="back", equipment="cable", movement_pattern="pull")

    prog_ex = await _add_exercise_to_day(client, headers, day["id"], ex["id"])

    resp = await client.delete(
        f"/api/v1/training/exercises-in-day/{prog_ex['id']}", headers=headers
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_exercise_from_day_not_found_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelExDayNF Gym")
    await _register(client, org_id, email="delexdaynf@test.com", role="trainer")
    headers = await _auth_headers(client, "delexdaynf@test.com")

    resp = await client.delete(
        f"/api/v1/training/exercises-in-day/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Prescribed sets
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_prescribed_set(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AddSet Prog Gym")
    await _register(client, org_id, email="addsetprog@test.com", role="trainer")
    headers = await _auth_headers(client, "addsetprog@test.com")

    program = await _create_program(client, headers, name="Prescribed Set Program")
    day = await _add_day(client, headers, program["id"])
    ex = await _create_exercise(client, headers, name="Bench", muscle_group="chest", movement_pattern="push")
    prog_ex = await _add_exercise_to_day(client, headers, day["id"], ex["id"])

    resp = await client.post(
        f"/api/v1/training/program-exercises/{prog_ex['id']}/sets",
        json={
            "position": 1,
            "set_type": "working",
            "rep_min": 6,
            "rep_max": 8,
            "rpe_target": 8.5,
            "rest_seconds": 180,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["position"] == 1
    assert data["set_type"] == "working"
    assert data["rep_min"] == 6
    assert data["rep_max"] == 8
    assert data["rpe_target"] == 8.5
    assert data["rest_seconds"] == 180
    assert data["program_exercise_id"] == prog_ex["id"]


@pytest.mark.asyncio
async def test_add_prescribed_set_defaults(client: AsyncClient) -> None:
    org_id = await _make_org(client, "SetDefaults Gym")
    await _register(client, org_id, email="setdefaults@test.com", role="trainer")
    headers = await _auth_headers(client, "setdefaults@test.com")

    program = await _create_program(client, headers, name="Defaults Program")
    day = await _add_day(client, headers, program["id"])
    ex = await _create_exercise(client, headers, name="Squat Defaults", muscle_group="quads", movement_pattern="squat")
    prog_ex = await _add_exercise_to_day(client, headers, day["id"], ex["id"])

    resp = await client.post(
        f"/api/v1/training/program-exercises/{prog_ex['id']}/sets",
        json={"position": 1},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["set_type"] == "working"
    assert data["rep_min"] == 8
    assert data["rep_max"] == 12
    assert data["rpe_target"] is None
    assert data["rest_seconds"] is None


@pytest.mark.asyncio
async def test_add_prescribed_set_all_set_types(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AllSetTypes Gym")
    await _register(client, org_id, email="allsettypes@test.com", role="trainer")
    headers = await _auth_headers(client, "allsettypes@test.com")

    program = await _create_program(client, headers, name="All Types Program")
    day = await _add_day(client, headers, program["id"])
    ex = await _create_exercise(client, headers, name="Press All Types", muscle_group="shoulders", movement_pattern="push")
    prog_ex = await _add_exercise_to_day(client, headers, day["id"], ex["id"])

    set_types = ["warm_up", "feeder", "working", "back_off", "top_set", "failure",
                 "drop_set", "rest_pause", "cluster", "burnout", "technique", "deload"]

    for i, st in enumerate(set_types):
        resp = await client.post(
            f"/api/v1/training/program-exercises/{prog_ex['id']}/sets",
            json={"position": i + 1, "set_type": st},
            headers=headers,
        )
        assert resp.status_code == 201, f"set_type '{st}' should be valid"
        assert resp.json()["set_type"] == st


@pytest.mark.asyncio
async def test_add_prescribed_set_invalid_type_returns_422(client: AsyncClient) -> None:
    org_id = await _make_org(client, "BadSetType Gym")
    await _register(client, org_id, email="badsetype@test.com", role="trainer")
    headers = await _auth_headers(client, "badsetype@test.com")

    program = await _create_program(client, headers, name="Bad Type Program")
    day = await _add_day(client, headers, program["id"])
    ex = await _create_exercise(client, headers, name="Some Exercise", muscle_group="core", movement_pattern="rotation")
    prog_ex = await _add_exercise_to_day(client, headers, day["id"], ex["id"])

    resp = await client.post(
        f"/api/v1/training/program-exercises/{prog_ex['id']}/sets",
        json={"position": 1, "set_type": "not_a_real_type"},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_add_prescribed_set_to_nonexistent_program_exercise_returns_404(
    client: AsyncClient,
) -> None:
    org_id = await _make_org(client, "SetNF Gym")
    await _register(client, org_id, email="setnf@test.com", role="trainer")
    headers = await _auth_headers(client, "setnf@test.com")

    resp = await client.post(
        f"/api/v1/training/program-exercises/{uuid.uuid4()}/sets",
        json={"position": 1},
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_prescribed_sets_appear_nested_in_program(client: AsyncClient) -> None:
    """Full happy path: create program → day → exercise → prescribed set, verify nesting."""
    org_id = await _make_org(client, "FullNest Gym")
    await _register(client, org_id, email="fullnest@test.com", role="trainer")
    headers = await _auth_headers(client, "fullnest@test.com")

    program = await _create_program(client, headers, name="Full Nesting Program")
    day = await _add_day(client, headers, program["id"], name="Back Day", day_tag="back")
    ex = await _create_exercise(client, headers, name="Seated Cable Row", muscle_group="back", equipment="cable", movement_pattern="pull")
    prog_ex = await _add_exercise_to_day(client, headers, day["id"], ex["id"])

    ps = await _add_prescribed_set(client, headers, prog_ex["id"], position=1, rep_min=10, rep_max=15)

    resp = await client.get(f"/api/v1/training/programs/{program['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    days = data["days"]
    assert len(days) == 1
    exs = days[0]["exercises"]
    assert len(exs) == 1
    sets = exs[0]["prescribed_sets"]
    assert len(sets) == 1
    assert sets[0]["id"] == ps["id"]
    assert sets[0]["rep_min"] == 10
    assert sets[0]["rep_max"] == 15


# ---------------------------------------------------------------------------
# Delete prescribed set
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_prescribed_set(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelPSet Gym")
    await _register(client, org_id, email="delpset@test.com", role="trainer")
    headers = await _auth_headers(client, "delpset@test.com")

    program = await _create_program(client, headers, name="Del Set Program")
    day = await _add_day(client, headers, program["id"])
    ex = await _create_exercise(client, headers, name="Del Set Exercise", muscle_group="chest", movement_pattern="push")
    prog_ex = await _add_exercise_to_day(client, headers, day["id"], ex["id"])
    ps = await _add_prescribed_set(client, headers, prog_ex["id"], position=1)

    resp = await client.delete(
        f"/api/v1/training/program-exercises/{prog_ex['id']}/sets/{ps['id']}",
        headers=headers,
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_prescribed_set_not_found_returns_404(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DelPSetNF Gym")
    await _register(client, org_id, email="delpsetknf@test.com", role="trainer")
    headers = await _auth_headers(client, "delpsetknf@test.com")

    program = await _create_program(client, headers, name="Del Set NF Program")
    day = await _add_day(client, headers, program["id"])
    ex = await _create_exercise(client, headers, name="NF Exercise", muscle_group="back", movement_pattern="pull")
    prog_ex = await _add_exercise_to_day(client, headers, day["id"], ex["id"])

    resp = await client.delete(
        f"/api/v1/training/program-exercises/{prog_ex['id']}/sets/{uuid.uuid4()}",
        headers=headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_prescribed_set_wrong_exercise_returns_404(client: AsyncClient) -> None:
    """Deleting a set using a different exercise's ID should return 404."""
    org_id = await _make_org(client, "DelPSetWrong Gym")
    await _register(client, org_id, email="delpsetwrong@test.com", role="trainer")
    headers = await _auth_headers(client, "delpsetwrong@test.com")

    program = await _create_program(client, headers, name="Wrong Ex Program")
    day = await _add_day(client, headers, program["id"])
    ex1 = await _create_exercise(client, headers, name="Ex One", muscle_group="chest", movement_pattern="push")
    ex2 = await _create_exercise(client, headers, name="Ex Two", muscle_group="back", movement_pattern="pull")
    prog_ex1 = await _add_exercise_to_day(client, headers, day["id"], ex1["id"], position=1)
    prog_ex2 = await _add_exercise_to_day(client, headers, day["id"], ex2["id"], position=2)

    ps = await _add_prescribed_set(client, headers, prog_ex1["id"], position=1)

    # Use prog_ex2's ID with the set belonging to prog_ex1 — should 404
    resp = await client.delete(
        f"/api/v1/training/program-exercises/{prog_ex2['id']}/sets/{ps['id']}",
        headers=headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Trainer program list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trainer_sees_programs_created_for_athletes(client: AsyncClient) -> None:
    """Trainer should see programs they created for athletes, not just their own."""
    org_id = await _make_org(client, "TrainerList Gym")
    athlete_id = await _register(client, org_id, email="athlete_tl@test.com", role="athlete")
    await _register(client, org_id, email="trainer_tl@test.com", role="trainer")

    trainer_headers = await _auth_headers(client, "trainer_tl@test.com")

    # Trainer creates a program for the athlete
    resp = await client.post(
        "/api/v1/training/programs",
        json={"name": "Athlete's Training Plan", "athlete_id": athlete_id},
        headers=trainer_headers,
    )
    assert resp.status_code == 201

    # Trainer lists programs — should include the one created for the athlete
    resp = await client.get("/api/v1/training/programs", headers=trainer_headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "Athlete's Training Plan" in names


@pytest.mark.asyncio
async def test_trainer_sees_own_programs_and_created_programs(client: AsyncClient) -> None:
    """Trainer list returns programs where athlete_id == trainer OR created_by_id == trainer."""
    org_id = await _make_org(client, "TrainerBoth Gym")
    athlete_id = await _register(client, org_id, email="athlete_tb@test.com", role="athlete")
    await _register(client, org_id, email="trainer_tb@test.com", role="trainer")

    trainer_headers = await _auth_headers(client, "trainer_tb@test.com")

    # Trainer creates a program for themselves (athlete_id defaults to self)
    self_program = await _create_program(client, trainer_headers, name="My Own Program")

    # Trainer creates a program for an athlete
    resp = await client.post(
        "/api/v1/training/programs",
        json={"name": "Athlete Program", "athlete_id": athlete_id},
        headers=trainer_headers,
    )
    assert resp.status_code == 201

    # Trainer's list should contain both
    resp = await client.get("/api/v1/training/programs", headers=trainer_headers)
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "My Own Program" in names
    assert "Athlete Program" in names
