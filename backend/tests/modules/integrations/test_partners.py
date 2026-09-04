"""Multi-platform partner integration tests."""

import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sign(payload: dict, secret: str) -> tuple[str, bytes]:
    """Compute HMAC-SHA256 signature for a webhook payload.

    Returns (header_value, raw_body_bytes).
    """
    body = json.dumps(payload, separators=(",", ":")).encode()
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={sig}", body


def _wellhub_payload(
    gympass_id: str = "1234567890123",
    gym_id: str = "GYM123",
    timestamp: str | None = None,
    transaction_id: str = "txn-abc123",
) -> dict:
    if timestamp is None:
        timestamp = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    return {
        "gympass_id": gympass_id,
        "gym_id": gym_id,
        "gym_unit_id": "UNIT456",
        "timestamp": timestamp,
        "transaction_id": transaction_id,
    }


def _totalpass_payload(
    member_id: str = "TP-MEMBER-001",
    gym_id: str = "TP-GYM123",
    timestamp: str | None = None,
    transaction_id: str = "tp-txn-001",
) -> dict:
    if timestamp is None:
        timestamp = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    return {
        "member_id": member_id,
        "gym_id": gym_id,
        "timestamp": timestamp,
        "transaction_id": transaction_id,
    }


async def _make_org(client: AsyncClient, name: str) -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _register(
    client: AsyncClient, email: str, role: str, org_id: str, pw: str = "securepass"
) -> str:
    resp = await client.post(
        "/api/v1/identity/auth/register",
        json={"email": email, "password": pw, "role": role, "organization_id": org_id},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _login(client: AsyncClient, email: str, pw: str = "securepass") -> str:
    resp = await client.post(
        "/api/v1/identity/auth/login", json={"email": email, "password": pw}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


_SECRET = "supersecrethmackey123456"


def _gym_id(suffix: str) -> str:
    """Each test gets its own gym_id to avoid cross-test uniqueness clashes."""
    return f"GYM-{suffix.upper()}"


async def _setup_org_and_config(
    client: AsyncClient, suffix: str, platform: str = "wellhub"
) -> tuple[str, str, str]:
    """Create org, admin, configure partner. Returns (org_id, admin_token, athlete_id)."""
    org = await _make_org(client, f"Partner Test Gym {suffix}")
    admin_email = f"admin-{suffix}@partner.com"
    athlete_email = f"athlete-{suffix}@partner.com"
    await _register(client, admin_email, "gym_admin", org)
    athlete_id = await _register(client, athlete_email, "athlete", org)
    token = await _login(client, admin_email)
    resp = await client.put(
        f"/api/v1/integrations/partners/{platform}/config",
        json={
            "external_gym_id": _gym_id(suffix),
            "bearer_token": "bearer_tok_xyz",
            "webhook_secret": _SECRET,
        },
        headers=_auth(token),
    )
    assert resp.status_code == 200, resp.text
    return org, token, athlete_id


# ---------------------------------------------------------------------------
# Platform discovery
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_platforms_returns_supported_platforms(client: AsyncClient) -> None:
    """GET /partners returns all supported platform names."""
    resp = await client.get("/api/v1/integrations/partners")
    assert resp.status_code == 200
    data = resp.json()
    assert "platforms" in data
    assert "wellhub" in data["platforms"]
    assert "totalpass" in data["platforms"]
    assert "sesi" in data["platforms"]


# ---------------------------------------------------------------------------
# Platform validation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unsupported_platform_returns_400(client: AsyncClient) -> None:
    """Unknown platform slug → 400 on any endpoint."""
    org = await _make_org(client, "Unsupported Platform Gym")
    admin_email = "admin-unsup@partner.com"
    await _register(client, admin_email, "gym_admin", org)
    token = await _login(client, admin_email)

    resp = await client.put(
        "/api/v1/integrations/partners/fakegym/config",
        json={
            "external_gym_id": "GYM-FAKE",
            "bearer_token": "tok",
            "webhook_secret": _SECRET,
        },
        headers=_auth(token),
    )
    assert resp.status_code == 400

    resp2 = await client.post(
        "/api/v1/integrations/partners/fakegym/webhook",
        content=b"{}",
        headers={"X-Signature": "sha256=00", "Content-Type": "application/json"},
    )
    assert resp2.status_code == 400


# ---------------------------------------------------------------------------
# Wellhub webhook tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_wellhub_webhook_valid_signature_records_attendance(
    client: AsyncClient,
) -> None:
    """Happy path: valid Wellhub signature + fresh timestamp → 200 + attendance recorded."""
    org, token, athlete_id = await _setup_org_and_config(client, "wh1", "wellhub")

    gympass_id = "1234567890001"
    link_resp = await client.post(
        "/api/v1/integrations/partners/wellhub/members",
        json={"user_id": athlete_id, "external_member_id": gympass_id},
        headers=_auth(token),
    )
    assert link_resp.status_code == 201, link_resp.text

    payload = _wellhub_payload(gympass_id=gympass_id, gym_id=_gym_id("wh1"))
    sig, body = _sign(payload, _SECRET)

    resp = await client.post(
        "/api/v1/integrations/partners/wellhub/webhook",
        content=body,
        headers={"X-Gympass-Signature": sig, "Content-Type": "application/json"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_wellhub_webhook_invalid_signature_returns_401(
    client: AsyncClient,
) -> None:
    """Wrong signature → 401."""
    org, token, athlete_id = await _setup_org_and_config(client, "wh2", "wellhub")

    payload = _wellhub_payload(gym_id=_gym_id("wh2"))
    _, body = _sign(payload, _SECRET)
    bad_sig = "sha256=0000000000000000000000000000000000000000000000000000000000000000"

    resp = await client.post(
        "/api/v1/integrations/partners/wellhub/webhook",
        content=body,
        headers={"X-Gympass-Signature": bad_sig, "Content-Type": "application/json"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_wellhub_webhook_old_timestamp_returns_401(client: AsyncClient) -> None:
    """Timestamp older than 5 minutes → 401 (replay attack prevention)."""
    org, token, athlete_id = await _setup_org_and_config(client, "wh3", "wellhub")

    old_ts = (datetime.now(UTC) - timedelta(minutes=10)).isoformat().replace("+00:00", "Z")
    payload = _wellhub_payload(gym_id=_gym_id("wh3"), timestamp=old_ts)
    sig, body = _sign(payload, _SECRET)

    resp = await client.post(
        "/api/v1/integrations/partners/wellhub/webhook",
        content=body,
        headers={"X-Gympass-Signature": sig, "Content-Type": "application/json"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_wellhub_webhook_unknown_gym_id_returns_401(client: AsyncClient) -> None:
    """Unknown gym_id returns 401 — not 404 — to avoid leaking gym existence."""
    payload = _wellhub_payload(gym_id="GYM_UNKNOWN_XYZ_PARTNERS")
    sig, body = _sign(payload, _SECRET)

    resp = await client.post(
        "/api/v1/integrations/partners/wellhub/webhook",
        content=body,
        headers={"X-Gympass-Signature": sig, "Content-Type": "application/json"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_wellhub_webhook_unlinked_member_returns_404(client: AsyncClient) -> None:
    """Gym found, signature valid, but external_member_id not linked → 404."""
    org, token, athlete_id = await _setup_org_and_config(client, "wh4", "wellhub")

    payload = _wellhub_payload(gympass_id="9999999999999", gym_id=_gym_id("wh4"))
    sig, body = _sign(payload, _SECRET)

    resp = await client.post(
        "/api/v1/integrations/partners/wellhub/webhook",
        content=body,
        headers={"X-Gympass-Signature": sig, "Content-Type": "application/json"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Config tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_partner_configure_requires_gym_admin(client: AsyncClient) -> None:
    """An athlete cannot configure a partner integration."""
    org = await _make_org(client, "Partner Perm Gym")
    athlete_email = "ath-perm@partner.com"
    await _register(client, athlete_email, "athlete", org)
    token = await _login(client, athlete_email)

    resp = await client.put(
        "/api/v1/integrations/partners/wellhub/config",
        json={
            "external_gym_id": "GYM-PERM",
            "bearer_token": "tok",
            "webhook_secret": _SECRET,
        },
        headers=_auth(token),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_partner_configure_and_retrieve_hides_secrets(client: AsyncClient) -> None:
    """Config response must not expose bearer_token or webhook_secret."""
    org, token, _ = await _setup_org_and_config(client, "wh-secret", "wellhub")

    resp = await client.get(
        "/api/v1/integrations/partners/wellhub/config",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "bearer_token" not in data
    assert "webhook_secret" not in data
    assert data["external_gym_id"] == _gym_id("wh-secret")
    assert data["platform"] == "wellhub"
    assert data["is_active"] is True


# ---------------------------------------------------------------------------
# Member link / unlink tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_partner_link_member_creates_mapping(client: AsyncClient) -> None:
    """Admin can link an athlete in their org to an external_member_id."""
    org, token, athlete_id = await _setup_org_and_config(client, "wh5", "wellhub")

    resp = await client.post(
        "/api/v1/integrations/partners/wellhub/members",
        json={"user_id": athlete_id, "external_member_id": "1234567890005"},
        headers=_auth(token),
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["user_id"] == athlete_id
    assert data["external_member_id"] == "1234567890005"

    list_resp = await client.get(
        "/api/v1/integrations/partners/wellhub/members",
        headers=_auth(token),
    )
    assert list_resp.status_code == 200
    assert any(m["user_id"] == athlete_id for m in list_resp.json())


@pytest.mark.asyncio
async def test_partner_unlink_member_removes_mapping(client: AsyncClient) -> None:
    """Admin can unlink an athlete; subsequent list shows they are gone."""
    org, token, athlete_id = await _setup_org_and_config(client, "wh6", "wellhub")

    await client.post(
        "/api/v1/integrations/partners/wellhub/members",
        json={"user_id": athlete_id, "external_member_id": "1234567890006"},
        headers=_auth(token),
    )

    del_resp = await client.delete(
        f"/api/v1/integrations/partners/wellhub/members/{athlete_id}",
        headers=_auth(token),
    )
    assert del_resp.status_code == 204

    list_resp = await client.get(
        "/api/v1/integrations/partners/wellhub/members",
        headers=_auth(token),
    )
    assert not any(m["user_id"] == athlete_id for m in list_resp.json())


@pytest.mark.asyncio
async def test_partner_link_member_cross_org_rejected(client: AsyncClient) -> None:
    """Admin from Org A cannot link a user that belongs to Org B."""
    org_a = await _make_org(client, "Partner OrgA")
    admin_a_email = "admin-a@p-cross.com"
    await _register(client, admin_a_email, "gym_admin", org_a)
    token_a = await _login(client, admin_a_email)
    await client.put(
        "/api/v1/integrations/partners/wellhub/config",
        json={
            "external_gym_id": "GYM-CROSS-A",
            "bearer_token": "bearer_tok_cross",
            "webhook_secret": _SECRET,
        },
        headers=_auth(token_a),
    )

    org_b = await _make_org(client, "Partner OrgB")
    athlete_b_id = await _register(client, "athlete-b@p-cross.com", "athlete", org_b)

    resp = await client.post(
        "/api/v1/integrations/partners/wellhub/members",
        json={"user_id": athlete_b_id, "external_member_id": "9876543210001"},
        headers=_auth(token_a),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# TotalPass-specific tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_totalpass_webhook_valid_records_attendance(
    client: AsyncClient,
) -> None:
    """TotalPass adapter uses member_id field and X-TotalPass-Signature header."""
    org, token, athlete_id = await _setup_org_and_config(client, "tp1", "totalpass")

    member_id = "TP-MEMBER-001"
    link_resp = await client.post(
        "/api/v1/integrations/partners/totalpass/members",
        json={"user_id": athlete_id, "external_member_id": member_id},
        headers=_auth(token),
    )
    assert link_resp.status_code == 201, link_resp.text

    payload = _totalpass_payload(member_id=member_id, gym_id=_gym_id("tp1"))
    sig, body = _sign(payload, _SECRET)

    resp = await client.post(
        "/api/v1/integrations/partners/totalpass/webhook",
        content=body,
        headers={"X-TotalPass-Signature": sig, "Content-Type": "application/json"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_totalpass_wrong_header_returns_401(client: AsyncClient) -> None:
    """Sending Wellhub signature header to TotalPass endpoint → 401 (not 200)."""
    org, token, athlete_id = await _setup_org_and_config(client, "tp2", "totalpass")

    payload = _totalpass_payload(gym_id=_gym_id("tp2"))
    sig, body = _sign(payload, _SECRET)

    # Send with wrong header name — server will get empty string for X-TotalPass-Signature
    resp = await client.post(
        "/api/v1/integrations/partners/totalpass/webhook",
        content=body,
        headers={"X-Gympass-Signature": sig, "Content-Type": "application/json"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Cross-platform isolation test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_wellhub_and_totalpass_members_independent_per_org(
    client: AsyncClient,
) -> None:
    """Same user can be linked on both wellhub and totalpass independently."""
    org = await _make_org(client, "Multi-Platform Gym")
    admin_email = "admin-multi@partner.com"
    athlete_email = "athlete-multi@partner.com"
    await _register(client, admin_email, "gym_admin", org)
    athlete_id = await _register(client, athlete_email, "athlete", org)
    token = await _login(client, admin_email)

    # Configure both platforms
    for platform, gym_suffix in [("wellhub", "MULTI-WH"), ("totalpass", "MULTI-TP")]:
        resp = await client.put(
            f"/api/v1/integrations/partners/{platform}/config",
            json={
                "external_gym_id": gym_suffix,
                "bearer_token": "tok",
                "webhook_secret": _SECRET,
            },
            headers=_auth(token),
        )
        assert resp.status_code == 200, resp.text

    # Link the same athlete on both platforms with different external IDs
    wh_resp = await client.post(
        "/api/v1/integrations/partners/wellhub/members",
        json={"user_id": athlete_id, "external_member_id": "WH-EXT-001"},
        headers=_auth(token),
    )
    assert wh_resp.status_code == 201, wh_resp.text

    tp_resp = await client.post(
        "/api/v1/integrations/partners/totalpass/members",
        json={"user_id": athlete_id, "external_member_id": "TP-EXT-001"},
        headers=_auth(token),
    )
    assert tp_resp.status_code == 201, tp_resp.text

    # Confirm both platforms list the athlete independently
    wh_list = await client.get(
        "/api/v1/integrations/partners/wellhub/members", headers=_auth(token)
    )
    tp_list = await client.get(
        "/api/v1/integrations/partners/totalpass/members", headers=_auth(token)
    )
    assert any(m["user_id"] == athlete_id for m in wh_list.json())
    assert any(m["user_id"] == athlete_id for m in tp_list.json())

    wh_member = next(m for m in wh_list.json() if m["user_id"] == athlete_id)
    tp_member = next(m for m in tp_list.json() if m["user_id"] == athlete_id)
    assert wh_member["external_member_id"] == "WH-EXT-001"
    assert tp_member["external_member_id"] == "TP-EXT-001"
