import pytest
from httpx import AsyncClient

# ── helpers ───────────────────────────────────────────────────────────────────

async def _make_org(client: AsyncClient, name: str = "Invite Gym") -> str:
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
async def test_invite_creates_pending_invite_for_unknown_email(client: AsyncClient) -> None:  # noqa: E501
    org_id = await _make_org(client, "Pending Gym")
    await _register(client, "trainer@pending.com", role="trainer", org_id=org_id)
    token = await _login(client, "trainer@pending.com")

    resp = await client.post(
        "/api/v1/identity/invites",
        json={"email": "newbie@pending.com", "role": "athlete"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newbie@pending.com"
    assert data["accepted_at"] is None


@pytest.mark.asyncio
async def test_invite_existing_independent_user_creates_pending_invite(client: AsyncClient) -> None:  # noqa: E501
    org_id = await _make_org(client, "Link Gym")
    await _register(client, "trainer@lg.com", role="trainer", org_id=org_id)
    await _register(client, "solo@lg.com", role="athlete")  # no org
    token = await _login(client, "trainer@lg.com")

    resp = await client.post(
        "/api/v1/identity/invites",
        json={"email": "solo@lg.com", "role": "athlete"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    # invite is pending — athlete must accept
    assert data["accepted_at"] is None


@pytest.mark.asyncio
async def test_invite_existing_user_from_other_org_blocked(client: AsyncClient) -> None:
    org1 = await _make_org(client, "Block Gym 1")
    org2 = await _make_org(client, "Block Gym 2")
    await _register(client, "trainer@bg.com", role="trainer", org_id=org1)
    await _register(client, "taken@bg.com", role="athlete", org_id=org2)
    token = await _login(client, "trainer@bg.com")

    resp = await client.post(
        "/api/v1/identity/invites",
        json={"email": "taken@bg.com"},
        headers=_auth(token),
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_with_pending_invite_does_not_auto_link(client: AsyncClient) -> None:
    org_id = await _make_org(client, "PendingReg Gym")
    await _register(client, "trainer@pr.com", role="trainer", org_id=org_id)
    token = await _login(client, "trainer@pr.com")

    # Trainer invites an email that has no account yet
    await client.post(
        "/api/v1/identity/invites",
        json={"email": "future@pr.com", "role": "athlete"},
        headers=_auth(token),
    )

    # User registers — invite stays pending, they are NOT auto-linked
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": "future@pr.com", "password": "securepass", "role": "athlete"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["organization_id"] is None  # still independent until they accept


@pytest.mark.asyncio
async def test_duplicate_pending_invite_blocked(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Dup Gym")
    await _register(client, "trainer@dup.com", role="trainer", org_id=org_id)
    token = await _login(client, "trainer@dup.com")

    await client.post(
        "/api/v1/identity/invites",
        json={"email": "dupe@dup.com"},
        headers=_auth(token),
    )
    resp = await client.post(
        "/api/v1/identity/invites",
        json={"email": "dupe@dup.com"},
        headers=_auth(token),
    )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_pending_invites(client: AsyncClient) -> None:
    org_id = await _make_org(client, "List Gym")
    await _register(client, "trainer@listg.com", role="trainer", org_id=org_id)
    token = await _login(client, "trainer@listg.com")

    await client.post(
        "/api/v1/identity/invites",
        json={"email": "invitee@listg.com"},
        headers=_auth(token),
    )
    resp = await client.get("/api/v1/identity/invites", headers=_auth(token))
    assert resp.status_code == 200
    emails = [i["email"] for i in resp.json()]
    assert "invitee@listg.com" in emails


@pytest.mark.asyncio
async def test_cancel_invite(client: AsyncClient) -> None:
    org_id = await _make_org(client, "Cancel Gym")
    await _register(client, "trainer@cg.com", role="trainer", org_id=org_id)
    token = await _login(client, "trainer@cg.com")

    resp = await client.post(
        "/api/v1/identity/invites",
        json={"email": "cancel_me@cg.com"},
        headers=_auth(token),
    )
    invite_id = resp.json()["id"]

    del_resp = await client.delete(
        f"/api/v1/identity/invites/{invite_id}", headers=_auth(token)
    )
    assert del_resp.status_code == 204

    list_resp = await client.get("/api/v1/identity/invites", headers=_auth(token))
    emails = [i["email"] for i in list_resp.json()]
    assert "cancel_me@cg.com" not in emails


@pytest.mark.asyncio
async def test_athlete_cannot_send_invite(client: AsyncClient) -> None:
    org_id = await _make_org(client, "NoInvite Gym")
    await _register(client, "athlete@ni.com", role="athlete", org_id=org_id)
    token = await _login(client, "athlete@ni.com")

    resp = await client.post(
        "/api/v1/identity/invites",
        json={"email": "someone@ni.com"},
        headers=_auth(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_invite_requires_auth(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/identity/invites", json={"email": "x@x.com"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_athlete_lists_own_pending_invites(client: AsyncClient) -> None:
    org_id = await _make_org(client, "InboxGym")
    await _register(client, "trainer@inbox.com", role="trainer", org_id=org_id)
    trainer_token = await _login(client, "trainer@inbox.com")

    await _register(client, "athlete@inbox.com", role="athlete")
    athlete_token = await _login(client, "athlete@inbox.com")

    # Trainer sends invite to athlete's email
    await client.post(
        "/api/v1/identity/invites",
        json={"email": "athlete@inbox.com", "role": "athlete"},
        headers=_auth(trainer_token),
    )

    resp = await client.get("/api/v1/identity/invites/mine", headers=_auth(athlete_token))
    assert resp.status_code == 200
    invites = resp.json()
    assert len(invites) == 1
    assert invites[0]["organization_name"] == "InboxGym"
    assert invites[0]["accepted_at"] is None


@pytest.mark.asyncio
async def test_athlete_accepts_invite(client: AsyncClient) -> None:
    org_id = await _make_org(client, "AcceptGym")
    await _register(client, "trainer@accept.com", role="trainer", org_id=org_id)
    trainer_token = await _login(client, "trainer@accept.com")

    await _register(client, "athlete@accept.com", role="athlete")
    athlete_token = await _login(client, "athlete@accept.com")

    inv_resp = await client.post(
        "/api/v1/identity/invites",
        json={"email": "athlete@accept.com", "role": "athlete"},
        headers=_auth(trainer_token),
    )
    invite_id = inv_resp.json()["id"]

    accept_resp = await client.post(
        f"/api/v1/identity/invites/{invite_id}/accept",
        headers=_auth(athlete_token),
    )
    assert accept_resp.status_code == 204

    me_resp = await client.get("/api/v1/identity/users/me", headers=_auth(athlete_token))
    assert me_resp.json()["organization_id"] == org_id


@pytest.mark.asyncio
async def test_athlete_declines_invite(client: AsyncClient) -> None:
    org_id = await _make_org(client, "DeclineGym")
    await _register(client, "trainer@decline.com", role="trainer", org_id=org_id)
    trainer_token = await _login(client, "trainer@decline.com")

    await _register(client, "athlete@decline.com", role="athlete")
    athlete_token = await _login(client, "athlete@decline.com")

    inv_resp = await client.post(
        "/api/v1/identity/invites",
        json={"email": "athlete@decline.com", "role": "athlete"},
        headers=_auth(trainer_token),
    )
    invite_id = inv_resp.json()["id"]

    dec_resp = await client.post(
        f"/api/v1/identity/invites/{invite_id}/decline",
        headers=_auth(athlete_token),
    )
    assert dec_resp.status_code == 204

    # Invite gone — trainer list should be empty
    list_resp = await client.get("/api/v1/identity/invites", headers=_auth(trainer_token))
    assert list_resp.json() == []

    # Athlete still has no org
    me_resp = await client.get("/api/v1/identity/users/me", headers=_auth(athlete_token))
    assert me_resp.json()["organization_id"] is None
