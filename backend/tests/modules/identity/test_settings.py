import pytest
from httpx import AsyncClient


async def _make_org(client: AsyncClient, name: str = "Settings Gym") -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register(
    client: AsyncClient,
    org_id: str | None = None,
    email: str = "user@example.com",
    password: str = "securepass",
    role: str = "athlete",
) -> None:
    body: dict = {"email": email, "password": password, "role": role}
    if org_id is not None:
        body["organization_id"] = org_id
    resp = await client.post("/api/v1/identity/auth/register", json=body)
    assert resp.status_code == 201


async def _login(client: AsyncClient, email: str, password: str = "securepass") -> str:
    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# PATCH /users/me
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_me_email(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateMe Gym")
    await _register(client, org_id, email="updateme@test.com")
    token = await _login(client, "updateme@test.com")

    resp = await client.patch(
        "/api/v1/identity/users/me",
        json={"email": "updateme_new@test.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "updateme_new@test.com"


@pytest.mark.asyncio
async def test_update_me_email_conflict_returns_409(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Conflict Gym")
    await _register(client, org_id, email="existing@test.com")
    await _register(client, org_id, email="changer@test.com")
    token = await _login(client, "changer@test.com")

    resp = await client.patch(
        "/api/v1/identity/users/me",
        json={"email": "existing@test.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_update_me_no_token_returns_401(client: AsyncClient) -> None:
    resp = await client.patch("/api/v1/identity/users/me", json={"email": "x@test.com"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /users/me/password
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_change_password_success(client: AsyncClient) -> None:
    org_id = await _make_org(client, "PWChange Gym")
    await _register(client, org_id, email="pwchange@test.com", password="oldpass1")
    token = await _login(client, "pwchange@test.com", "oldpass1")

    resp = await client.post(
        "/api/v1/identity/users/me/password",
        json={"current_password": "oldpass1", "new_password": "newpass1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204

    # verify new password works
    new_token = await _login(client, "pwchange@test.com", "newpass1")
    assert new_token


@pytest.mark.asyncio
async def test_change_password_wrong_current_returns_400(client: AsyncClient) -> None:
    org_id = await _make_org(client, "BadPW Gym")
    await _register(client, org_id, email="badpw@test.com", password="correctone")
    token = await _login(client, "badpw@test.com", "correctone")

    resp = await client.post(
        "/api/v1/identity/users/me/password",
        json={"current_password": "wrongone!", "new_password": "newpass12"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_change_password_no_token_returns_401(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/identity/users/me/password",
        json={"current_password": "x", "new_password": "y"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /organizations/current
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_my_organization(client: AsyncClient) -> None:
    org_id = await _make_org(client, "MyOrg Gym")
    await _register(client, org_id, email="orgmember@test.com")
    token = await _login(client, "orgmember@test.com")

    resp = await client.get(
        "/api/v1/identity/organizations/current",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == org_id
    assert data["name"] == "MyOrg Gym"


@pytest.mark.asyncio
async def test_get_my_organization_no_org_returns_404(client: AsyncClient) -> None:
    await _register(client, email="solo_org@test.com")
    token = await _login(client, "solo_org@test.com")

    resp = await client.get(
        "/api/v1/identity/organizations/current",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_my_organization_no_token_returns_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/identity/organizations/current")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PATCH /organizations/current
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_organization_as_trainer(client: AsyncClient) -> None:
    org_id = await _make_org(client, "UpdateOrg Gym")
    await _register(client, org_id, email="orgtrainer@test.com", role="trainer")
    token = await _login(client, "orgtrainer@test.com")

    resp = await client.patch(
        "/api/v1/identity/organizations/current",
        json={"phone": "11999999999", "website": "https://gym.example.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["phone"] == "11999999999"
    assert data["website"] == "https://gym.example.com"
    assert data["name"] == "UpdateOrg Gym"


@pytest.mark.asyncio
async def test_update_organization_as_athlete_returns_403(client: AsyncClient) -> None:
    org_id = await _make_org(client, "NoEdit Gym")
    await _register(client, org_id, email="noedit@test.com", role="athlete")
    token = await _login(client, "noedit@test.com")

    resp = await client.patch(
        "/api/v1/identity/organizations/current",
        json={"phone": "11000000000"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_update_organization_no_token_returns_401(client: AsyncClient) -> None:
    resp = await client.patch(
        "/api/v1/identity/organizations/current",
        json={"phone": "11000000000"},
    )
    assert resp.status_code == 401
