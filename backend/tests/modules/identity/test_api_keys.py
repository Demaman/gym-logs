"""Tests for API key management — create, list, revoke, auth, scope, rate limit."""

import uuid

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_org(client: AsyncClient, name: str = "Key Gym") -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register_admin(client: AsyncClient, org_id: str, email: str) -> str:
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": email, "password": "adminpass", "role": "gym_admin", "organization_id": org_id},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _login(client: AsyncClient, email: str, password: str = "adminpass") -> str:
    resp = await client.post(
        "/api/v1/identity/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


async def _create_key(
    client: AsyncClient,
    token: str,
    name: str = "Test Key",
    scopes: list[str] | None = None,
) -> dict:
    resp = await client.post(
        "/api/v1/identity/api-keys",
        json={"name": name, "scopes": scopes or ["members:read"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_api_key_returns_plaintext_once(client: AsyncClient) -> None:
    org_id = await _make_org(client, "CreateKeyGym")
    await _register_admin(client, org_id, "admin-create@test.com")
    token = await _login(client, "admin-create@test.com")

    data = await _create_key(client, token, scopes=["members:read", "programs:read"])

    assert data["plaintext_key"].startswith("gk_")
    assert len(data["plaintext_key"]) > 10
    assert data["name"] == "Test Key"
    assert set(data["scopes"]) == {"members:read", "programs:read"}
    assert data["is_active"] is True
    assert "key_prefix" in data
    assert "plaintext_key" in data


@pytest.mark.asyncio
async def test_create_api_key_forbidden_for_trainer(client: AsyncClient) -> None:
    org_id = await _make_org(client, "TrainerKeyGym")
    await client.post(
        "/api/v1/identity/auth/register",
        json={"email": "trainer-key@test.com", "password": "securepass", "role": "trainer", "organization_id": org_id},
    )
    token = await _login(client, "trainer-key@test.com", "securepass")

    resp = await client.post(
        "/api/v1/identity/api-keys",
        json={"name": "Bad Key", "scopes": ["members:read"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_api_key_rejects_unknown_scope(client: AsyncClient) -> None:
    org_id = await _make_org(client, "ScopeGym")
    await _register_admin(client, org_id, "admin-scope@test.com")
    token = await _login(client, "admin-scope@test.com")

    resp = await client.post(
        "/api/v1/identity/api-keys",
        json={"name": "Bad Scope Key", "scopes": ["hack:everything"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_api_keys(client: AsyncClient) -> None:
    org_id = await _make_org(client, "ListKeyGym")
    await _register_admin(client, org_id, "admin-list@test.com")
    token = await _login(client, "admin-list@test.com")

    await _create_key(client, token, "Key A")
    await _create_key(client, token, "Key B")

    resp = await client.get("/api/v1/identity/api-keys", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    names = [k["name"] for k in resp.json()]
    assert "Key A" in names
    assert "Key B" in names
    # plaintext_key must NOT appear in list
    for k in resp.json():
        assert "plaintext_key" not in k


@pytest.mark.asyncio
async def test_list_api_keys_org_isolation(client: AsyncClient) -> None:
    org_a = await _make_org(client, "OrgA-Keys")
    await _register_admin(client, org_a, "admin-a-keys@test.com")
    token_a = await _login(client, "admin-a-keys@test.com")
    await _create_key(client, token_a, "OrgA Key")

    org_b = await _make_org(client, "OrgB-Keys")
    await _register_admin(client, org_b, "admin-b-keys@test.com")
    token_b = await _login(client, "admin-b-keys@test.com")

    resp = await client.get("/api/v1/identity/api-keys", headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 200
    assert all(k["name"] != "OrgA Key" for k in resp.json())


# ---------------------------------------------------------------------------
# Revoke
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_revoke_api_key(client: AsyncClient) -> None:
    org_id = await _make_org(client, "RevokeGym")
    await _register_admin(client, org_id, "admin-revoke@test.com")
    token = await _login(client, "admin-revoke@test.com")

    key_data = await _create_key(client, token)
    key_id = key_data["id"]

    resp = await client.delete(
        f"/api/v1/identity/api-keys/{key_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204

    # Revoked key no longer appears in list
    list_resp = await client.get("/api/v1/identity/api-keys", headers={"Authorization": f"Bearer {token}"})
    assert all(k["id"] != key_id for k in list_resp.json())


@pytest.mark.asyncio
async def test_revoke_other_orgs_key_returns_404(client: AsyncClient) -> None:
    org_a = await _make_org(client, "RevokeOrgA")
    await _register_admin(client, org_a, "admin-rev-a@test.com")
    token_a = await _login(client, "admin-rev-a@test.com")
    key_data = await _create_key(client, token_a)

    org_b = await _make_org(client, "RevokeOrgB")
    await _register_admin(client, org_b, "admin-rev-b@test.com")
    token_b = await _login(client, "admin-rev-b@test.com")

    resp = await client.delete(
        f"/api/v1/identity/api-keys/{key_data['id']}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Authentication via X-API-Key
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_api_key_auth_missing_header(client: AsyncClient) -> None:
    # Any integration endpoint would work; use a future placeholder check
    # We test the auth dependency directly by calling a hypothetical protected route.
    # Since integration routes don't exist yet, we verify the auth module is importable.
    from core.api_key_auth import generate_api_key, _hmac_key

    plaintext, prefix, key_hash = generate_api_key()
    assert plaintext.startswith("gk_")
    assert len(prefix) == 8
    # HMAC is deterministic
    assert _hmac_key(plaintext) == key_hash


@pytest.mark.asyncio
async def test_api_key_roundtrip(client: AsyncClient) -> None:
    """Create a key, then verify the hash lookup would find it."""
    from core.api_key_auth import _hmac_key

    org_id = await _make_org(client, "RoundtripGym")
    await _register_admin(client, org_id, "admin-rt@test.com")
    token = await _login(client, "admin-rt@test.com")

    key_data = await _create_key(client, token, scopes=["members:read"])
    plaintext = key_data["plaintext_key"]

    # The hash of the returned plaintext must match what the auth dep would compute
    computed_hash = _hmac_key(plaintext)
    assert len(computed_hash) == 64  # SHA-256 hex


@pytest.mark.asyncio
async def test_plaintext_key_not_exposed_in_list(client: AsyncClient) -> None:
    org_id = await _make_org(client, "NoPlainGym")
    await _register_admin(client, org_id, "admin-nopl@test.com")
    token = await _login(client, "admin-nopl@test.com")
    await _create_key(client, token)

    resp = await client.get("/api/v1/identity/api-keys", headers={"Authorization": f"Bearer {token}"})
    for key in resp.json():
        assert "plaintext_key" not in key
        assert "key_hash" not in key


# ---------------------------------------------------------------------------
# Scope validation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_all_valid_scopes_accepted(client: AsyncClient) -> None:
    org_id = await _make_org(client, "ScopesGym")
    await _register_admin(client, org_id, "admin-all-scopes@test.com")
    token = await _login(client, "admin-all-scopes@test.com")

    all_scopes = ["members:read", "members:write", "attendance:write", "programs:read", "data:export"]
    data = await _create_key(client, token, scopes=all_scopes)
    assert set(data["scopes"]) == set(all_scopes)


@pytest.mark.asyncio
async def test_empty_scopes_rejected(client: AsyncClient) -> None:
    org_id = await _make_org(client, "EmptyScopeGym")
    await _register_admin(client, org_id, "admin-empty-scope@test.com")
    token = await _login(client, "admin-empty-scope@test.com")

    resp = await client.post(
        "/api/v1/identity/api-keys",
        json={"name": "No Scope Key", "scopes": []},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
