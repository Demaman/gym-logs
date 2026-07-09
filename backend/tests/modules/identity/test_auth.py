import uuid

import pytest
from httpx import AsyncClient


async def _make_org(client: AsyncClient, name: str = "Test Gym") -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register(
    client: AsyncClient,
    org_id: str | None = None,
    email: str = "user@example.com",
    password: str = "securepass",
    role: str = "athlete",
):
    body: dict = {"email": email, "password": password, "role": role}
    if org_id is not None:
        body["organization_id"] = org_id
    return await client.post("/api/v1/identity/auth/register", json=body)


async def _login(client: AsyncClient, email: str, password: str) -> str:
    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_user(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Reg Gym")
    resp = await _register(client, org_id, email="athlete1@test.com")
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "athlete1@test.com"
    assert data["role"] == "athlete"
    assert data["organization_id"] == org_id
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_solo_user(client: AsyncClient) -> None:
    resp = await _register(client, email="solo@test.com", role="athlete")
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "solo@test.com"
    assert data["organization_id"] is None


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_409(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Dup Gym")
    await _register(client, org_id, email="dup@test.com")
    resp = await _register(client, org_id, email="dup@test.com")
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_unknown_org_returns_404(client: AsyncClient) -> None:
    resp = await _register(
        client,
        org_id=str(uuid.uuid4()),
        email="ghost@test.com",
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_register_short_password_returns_422(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Short Pass Gym")
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={
            "email": "short@test.com",
            "password": "abc",
            "role": "athlete",
            "organization_id": org_id,
        },
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login / auth flow
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Login Gym")
    await _register(client, org_id, email="login@test.com", password="mypassword")

    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": "login@test.com", "password": "mypassword"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Bad Pass Gym")
    await _register(client, org_id, email="badpass@test.com", password="correctpass")

    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": "badpass@test.com", "password": "wrongpass"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email_returns_401(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": "nobody@test.com", "password": "whatever"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# /users/me
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Me Gym")
    await _register(client, org_id, email="me@test.com", password="mypassword")
    token = await _login(client, "me@test.com", "mypassword")

    resp = await client.get(
        "/api/v1/identity/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "me@test.com"
    assert data["organization_id"] == org_id


@pytest.mark.asyncio
async def test_get_me_solo_user(client: AsyncClient) -> None:
    await _register(
        client, email="solo_me@test.com", password="mypassword", role="athlete"
    )
    token = await _login(client, "solo_me@test.com", "mypassword")

    resp = await client.get(
        "/api/v1/identity/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "solo_me@test.com"
    assert data["organization_id"] is None


@pytest.mark.asyncio
async def test_get_me_no_token_returns_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/identity/users/me")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Logout / refresh
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_logout_and_refresh_revoked(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Logout Gym")
    await _register(client, org_id, email="logout@test.com", password="mypassword")

    login = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": "logout@test.com", "password": "mypassword"},
    )
    tokens = login.json()
    refresh_token = tokens["refresh_token"]

    await client.post(
        "/api/v1/identity/auth/logout",
        json={"refresh_token": refresh_token},
    )

    resp = await client.post(
        "/api/v1/identity/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Memberships
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_membership_in_org(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Membership Gym")
    await _register(
        client,
        org_id,
        email="trainer_org@test.com",
        password="pass1234",
        role="trainer",
    )
    await _register(
        client,
        org_id,
        email="athlete_org@test.com",
        password="pass1234",
        role="athlete",
    )
    token = await _login(client, "trainer_org@test.com", "pass1234")

    trainer_id = (
        await client.get(
            "/api/v1/identity/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
    ).json()["id"]

    athlete_token = await _login(client, "athlete_org@test.com", "pass1234")
    athlete_id = (
        await client.get(
            "/api/v1/identity/users/me",
            headers={"Authorization": f"Bearer {athlete_token}"},
        )
    ).json()["id"]

    resp = await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": trainer_id, "athlete_id": athlete_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["organization_id"] == org_id
    assert data["trainer_id"] == trainer_id
    assert data["athlete_id"] == athlete_id


@pytest.mark.asyncio
async def test_create_membership_solo(client: AsyncClient) -> None:
    """Independent trainer + independent athlete — both have NULL org."""
    await _register(
        client, email="solo_trainer@test.com", password="pass1234", role="trainer"
    )
    await _register(
        client, email="solo_athlete@test.com", password="pass1234", role="athlete"
    )
    token = await _login(client, "solo_trainer@test.com", "pass1234")

    trainer_id = (
        await client.get(
            "/api/v1/identity/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
    ).json()["id"]

    athlete_token = await _login(client, "solo_athlete@test.com", "pass1234")
    athlete_id = (
        await client.get(
            "/api/v1/identity/users/me",
            headers={"Authorization": f"Bearer {athlete_token}"},
        )
    ).json()["id"]

    resp = await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": trainer_id, "athlete_id": athlete_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["organization_id"] is None


@pytest.mark.asyncio
async def test_create_membership_cross_space_returns_400(client: AsyncClient) -> None:
    """Trainer in an org, athlete is independent — must be rejected."""
    org_id = await _make_org(client, "Cross Gym")
    await _register(
        client,
        org_id,
        email="org_trainer@test.com",
        password="pass1234",
        role="trainer",
    )
    await _register(
        client, email="ind_athlete@test.com", password="pass1234", role="athlete"
    )
    token = await _login(client, "org_trainer@test.com", "pass1234")

    trainer_id = (
        await client.get(
            "/api/v1/identity/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
    ).json()["id"]

    athlete_token = await _login(client, "ind_athlete@test.com", "pass1234")
    athlete_id = (
        await client.get(
            "/api/v1/identity/users/me",
            headers={"Authorization": f"Bearer {athlete_token}"},
        )
    ).json()["id"]

    resp = await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": trainer_id, "athlete_id": athlete_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_membership_invalid_roles_returns_400(
    client: AsyncClient,
) -> None:
    """Two athletes cannot form a membership — trainer_id must be trainer/gym_admin."""
    await _register(
        client, email="athlete_a@test.com", password="pass1234", role="athlete"
    )
    await _register(
        client, email="athlete_b@test.com", password="pass1234", role="athlete"
    )
    token = await _login(client, "athlete_a@test.com", "pass1234")

    trainer_id = (
        await client.get(
            "/api/v1/identity/users/me",
            headers={"Authorization": f"Bearer {token}"},
        )
    ).json()["id"]

    athlete_token = await _login(client, "athlete_b@test.com", "pass1234")
    athlete_id = (
        await client.get(
            "/api/v1/identity/users/me",
            headers={"Authorization": f"Bearer {athlete_token}"},
        )
    ).json()["id"]

    resp = await client.post(
        "/api/v1/identity/memberships",
        json={"trainer_id": trainer_id, "athlete_id": athlete_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
