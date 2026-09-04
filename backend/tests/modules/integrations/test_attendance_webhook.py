"""Integration attendance webhook tests — external platform check-ins via API key."""

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_org(client: AsyncClient, name: str) -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register(client: AsyncClient, email: str, role: str, org_id: str, pw: str = "securepass") -> str:
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": email, "password": pw, "role": role, "organization_id": org_id},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _login(client: AsyncClient, email: str, pw: str = "securepass") -> str:
    resp = await client.post("/api/v1/identity/auth/login", json={"email": email, "password": pw})
    assert resp.status_code == 200
    return resp.json()["access_token"]


async def _create_api_key(client: AsyncClient, token: str, scopes: list[str]) -> str:
    resp = await client.post(
        "/api/v1/identity/api-keys",
        json={"name": "Integration Key", "scopes": scopes},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["plaintext_key"]


def _api_key_header(key: str) -> dict:
    return {"X-API-Key": key}


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_webhook_checkin_records_attendance(client: AsyncClient) -> None:
    org = await _make_org(client, "WH Gym 1")
    await _register(client, "admin-wh1@wh1.com", "gym_admin", org)
    await _register(client, "athlete-wh1@wh1.com", "athlete", org)
    token = await _login(client, "admin-wh1@wh1.com")
    api_key = await _create_api_key(client, token, ["attendance:write"])

    resp = await client.post(
        "/api/v1/integrations/attendance/checkin",
        json={"email": "athlete-wh1@wh1.com", "source": "wellhub"},
        headers=_api_key_header(api_key),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["recorded"] is True
    assert data["message"] == "Attendance recorded"


@pytest.mark.asyncio
async def test_webhook_checkin_idempotent_same_day(client: AsyncClient) -> None:
    """Second call on same day returns recorded=False without creating a duplicate."""
    org = await _make_org(client, "WH Gym 2")
    await _register(client, "admin-wh2@wh2.com", "gym_admin", org)
    await _register(client, "athlete-wh2@wh2.com", "athlete", org)
    token = await _login(client, "admin-wh2@wh2.com")
    api_key = await _create_api_key(client, token, ["attendance:write"])

    payload = {"email": "athlete-wh2@wh2.com", "source": "wellhub"}
    headers = _api_key_header(api_key)

    first = await client.post("/api/v1/integrations/attendance/checkin", json=payload, headers=headers)
    assert first.json()["recorded"] is True

    second = await client.post("/api/v1/integrations/attendance/checkin", json=payload, headers=headers)
    assert second.status_code == 200
    assert second.json()["recorded"] is False

    # Manual summary check — still only 1 unique check-in today
    jwt = await _login(client, "admin-wh2@wh2.com")
    summary = await client.get(
        "/api/v1/logs/attendance/summary",
        headers={"Authorization": f"Bearer {jwt}"},
    )
    assert summary.json()["today_count"] == 1


@pytest.mark.asyncio
async def test_webhook_checkin_with_external_ref(client: AsyncClient) -> None:
    org = await _make_org(client, "WH Gym 3")
    await _register(client, "admin-wh3@wh3.com", "gym_admin", org)
    await _register(client, "athlete-wh3@wh3.com", "athlete", org)
    token = await _login(client, "admin-wh3@wh3.com")
    api_key = await _create_api_key(client, token, ["attendance:write"])

    resp = await client.post(
        "/api/v1/integrations/attendance/checkin",
        json={
            "email": "athlete-wh3@wh3.com",
            "source": "totalpass",
            "external_ref": "TP-TX-99887766",
        },
        headers=_api_key_header(api_key),
    )
    assert resp.status_code == 200
    assert resp.json()["recorded"] is True


@pytest.mark.asyncio
async def test_webhook_different_platforms_both_record(client: AsyncClient) -> None:
    """Wellhub and TotalPass check-ins on the same day are each recorded once."""
    org = await _make_org(client, "WH Gym 4")
    await _register(client, "admin-wh4@wh4.com", "gym_admin", org)
    await _register(client, "athlete-wh4@wh4.com", "athlete", org)
    token = await _login(client, "admin-wh4@wh4.com")
    api_key = await _create_api_key(client, token, ["attendance:write"])

    for source in ("wellhub", "totalpass"):
        resp = await client.post(
            "/api/v1/integrations/attendance/checkin",
            json={"email": "athlete-wh4@wh4.com", "source": source},
            headers=_api_key_header(api_key),
        )
        assert resp.json()["recorded"] is True

    # Headcount should still be 1 (unique members, not records)
    jwt = await _login(client, "admin-wh4@wh4.com")
    summary = await client.get(
        "/api/v1/logs/attendance/summary",
        headers={"Authorization": f"Bearer {jwt}"},
    )
    assert summary.json()["today_count"] == 1


# ---------------------------------------------------------------------------
# Error cases
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_webhook_member_not_found_returns_404(client: AsyncClient) -> None:
    org = await _make_org(client, "WH Gym 5")
    await _register(client, "admin-wh5@wh5.com", "gym_admin", org)
    token = await _login(client, "admin-wh5@wh5.com")
    api_key = await _create_api_key(client, token, ["attendance:write"])

    resp = await client.post(
        "/api/v1/integrations/attendance/checkin",
        json={"email": "ghost@nowhere.com", "source": "wellhub"},
        headers=_api_key_header(api_key),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_webhook_missing_api_key_returns_401(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/integrations/attendance/checkin",
        json={"email": "anyone@example.com", "source": "wellhub"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_webhook_wrong_scope_returns_403(client: AsyncClient) -> None:
    org = await _make_org(client, "WH Gym 6")
    await _register(client, "admin-wh6@wh6.com", "gym_admin", org)
    token = await _login(client, "admin-wh6@wh6.com")
    # Key with read-only scope
    api_key = await _create_api_key(client, token, ["members:read"])

    resp = await client.post(
        "/api/v1/integrations/attendance/checkin",
        json={"email": "anyone@example.com", "source": "wellhub"},
        headers=_api_key_header(api_key),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_webhook_reserved_source_rejected(client: AsyncClient) -> None:
    org = await _make_org(client, "WH Gym 7")
    await _register(client, "admin-wh7@wh7.com", "gym_admin", org)
    await _register(client, "athlete-wh7@wh7.com", "athlete", org)
    token = await _login(client, "admin-wh7@wh7.com")
    api_key = await _create_api_key(client, token, ["attendance:write"])

    for reserved in ("session_log", "manual"):
        resp = await client.post(
            "/api/v1/integrations/attendance/checkin",
            json={"email": "athlete-wh7@wh7.com", "source": reserved},
            headers=_api_key_header(api_key),
        )
        assert resp.status_code == 422, f"Expected 422 for reserved source '{reserved}'"


@pytest.mark.asyncio
async def test_webhook_cross_org_member_not_found(client: AsyncClient) -> None:
    """API key from Org A cannot check in a member from Org B."""
    org_a = await _make_org(client, "WH OrgA")
    await _register(client, "admin-a-wh@oa.com", "gym_admin", org_a)
    token_a = await _login(client, "admin-a-wh@oa.com")
    api_key_a = await _create_api_key(client, token_a, ["attendance:write"])

    org_b = await _make_org(client, "WH OrgB")
    await _register(client, "athlete-b-wh@ob.com", "athlete", org_b)

    resp = await client.post(
        "/api/v1/integrations/attendance/checkin",
        json={"email": "athlete-b-wh@ob.com", "source": "wellhub"},
        headers=_api_key_header(api_key_a),
    )
    assert resp.status_code == 404
