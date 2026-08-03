import pytest
from httpx import AsyncClient

# ── helpers ───────────────────────────────────────────────────────────────────

async def _make_org(client: AsyncClient, name: str = "Test Gym") -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register(
    client: AsyncClient,
    email: str,
    role: str = "athlete",
    org_id: str | None = None,
    password: str = "securepass",
) -> str:
    body: dict = {"email": email, "password": password, "role": role}
    if org_id:
        body["organization_id"] = org_id
    resp = await client.post("/api/v1/identity/auth/register", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _login(client: AsyncClient, email: str, password: str = "securepass") -> str:
    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_membership_returns_enriched_response(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Enriched Gym")
    trainer_id = await _register(
        client, "trainer@eg.com", role="trainer", org_id=org_id
    )
    athlete_id = await _register(
        client, "athlete@eg.com", role="athlete", org_id=org_id
    )
    token = await _login(client, "trainer@eg.com")

    resp = await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": trainer_id, "athlete_id": athlete_id},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["trainer_email"] == "trainer@eg.com"
    assert data["athlete_email"] == "athlete@eg.com"
    assert data["organization_id"] == org_id


@pytest.mark.asyncio
async def test_trainer_sees_only_own_athletes(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Scope Gym")
    t1_id = await _register(client, "t1@sg.com", role="trainer", org_id=org_id)
    t2_id = await _register(client, "t2@sg.com", role="trainer", org_id=org_id)
    a1_id = await _register(client, "a1@sg.com", role="athlete", org_id=org_id)
    a2_id = await _register(client, "a2@sg.com", role="athlete", org_id=org_id)

    t1_token = await _login(client, "t1@sg.com")
    t2_token = await _login(client, "t2@sg.com")

    # t1 links a1, t2 links a2
    await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": t1_id, "athlete_id": a1_id},
        headers=_auth(t1_token),
    )
    await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": t2_id, "athlete_id": a2_id},
        headers=_auth(t2_token),
    )

    resp = await client.get(
        "/api/v1/identity/members/athletes", headers=_auth(t1_token)
    )
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()]
    assert "a1@sg.com" in emails
    assert "a2@sg.com" not in emails


@pytest.mark.asyncio
async def test_list_my_memberships(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Mine Gym")
    t_id = await _register(client, "mine_t@mg.com", role="trainer", org_id=org_id)
    a_id = await _register(client, "mine_a@mg.com", role="athlete", org_id=org_id)
    token = await _login(client, "mine_t@mg.com")

    await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": t_id, "athlete_id": a_id},
        headers=_auth(token),
    )
    resp = await client.get("/api/v1/identity/memberships/mine", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["athlete_email"] == "mine_a@mg.com"


@pytest.mark.asyncio
async def test_gym_admin_sees_all_org_memberships(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Admin Gym")
    await _register(client, "admin@agym.com", role="gym_admin", org_id=org_id)
    t_id = await _register(client, "t@agym.com", role="trainer", org_id=org_id)
    a_id = await _register(client, "a@agym.com", role="athlete", org_id=org_id)
    t_token = await _login(client, "t@agym.com")
    admin_token = await _login(client, "admin@agym.com")

    await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": t_id, "athlete_id": a_id},
        headers=_auth(t_token),
    )
    resp = await client.get("/api/v1/identity/memberships", headers=_auth(admin_token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_athlete_sees_own_trainer(client: AsyncClient) -> None:
    org_id = await _make_org(client, "My Trainer Gym")
    t_id = await _register(client, "trn@mtg.com", role="trainer", org_id=org_id)
    a_id = await _register(client, "ath@mtg.com", role="athlete", org_id=org_id)
    t_token = await _login(client, "trn@mtg.com")
    a_token = await _login(client, "ath@mtg.com")

    await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": t_id, "athlete_id": a_id},
        headers=_auth(t_token),
    )
    resp = await client.get(
        "/api/v1/identity/members/my-trainer", headers=_auth(a_token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data is not None
    assert data["trainer_email"] == "trn@mtg.com"


@pytest.mark.asyncio
async def test_athlete_with_no_trainer_returns_null(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Lonely Gym")
    await _register(client, "lonely@lg.com", role="athlete", org_id=org_id)
    token = await _login(client, "lonely@lg.com")
    resp = await client.get("/api/v1/identity/members/my-trainer", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() is None


@pytest.mark.asyncio
async def test_trainer_deletes_own_membership(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Delete Gym")
    t_id = await _register(client, "del_t@dg.com", role="trainer", org_id=org_id)
    a_id = await _register(client, "del_a@dg.com", role="athlete", org_id=org_id)
    token = await _login(client, "del_t@dg.com")

    m_resp = await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": t_id, "athlete_id": a_id},
        headers=_auth(token),
    )
    m_id = m_resp.json()["id"]
    resp = await client.delete(
        f"/api/v1/identity/memberships/{m_id}", headers=_auth(token)
    )
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_other_trainer_cannot_delete_membership(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Perm Gym")
    t1_id = await _register(client, "pt1@pg.com", role="trainer", org_id=org_id)
    await _register(client, "pt2@pg.com", role="trainer", org_id=org_id)
    a_id = await _register(client, "pa@pg.com", role="athlete", org_id=org_id)
    t1_token = await _login(client, "pt1@pg.com")
    t2_token = await _login(client, "pt2@pg.com")

    m_resp = await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": t1_id, "athlete_id": a_id},
        headers=_auth(t1_token),
    )
    m_id = m_resp.json()["id"]
    resp = await client.delete(
        f"/api/v1/identity/memberships/{m_id}", headers=_auth(t2_token)
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_cross_org_membership_blocked(client: AsyncClient) -> None:
    org1 = await _make_org(client, "Org One")
    org2 = await _make_org(client, "Org Two")
    t_id = await _register(client, "cross_t@org.com", role="trainer", org_id=org1)
    a_id = await _register(client, "cross_a@org.com", role="athlete", org_id=org2)
    token = await _login(client, "cross_t@org.com")

    resp = await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": t_id, "athlete_id": a_id},
        headers=_auth(token),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_gym_admin_lists_org_trainers(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Trainer List Gym")
    await _register(client, "tadmin@tlg.com", role="gym_admin", org_id=org_id)
    await _register(client, "ttr1@tlg.com", role="trainer", org_id=org_id)
    await _register(client, "ttr2@tlg.com", role="trainer", org_id=org_id)
    token = await _login(client, "tadmin@tlg.com")

    resp = await client.get("/api/v1/identity/members/trainers", headers=_auth(token))
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()]
    assert "ttr1@tlg.com" in emails
    assert "ttr2@tlg.com" in emails
    assert all(u["role"] in ("trainer", "gym_admin") for u in resp.json())


@pytest.mark.asyncio
async def test_list_memberships_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/identity/memberships/mine")
    assert resp.status_code == 401
