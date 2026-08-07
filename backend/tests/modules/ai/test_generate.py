"""Integration tests for AI program generation."""

import json
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from db.models.identity.organization import Organization

# ── Helpers shared with other test modules ────────────────────────────────────


async def _make_org(client: AsyncClient, name: str = "Test Gym") -> str:
    resp = await client.post("/api/v1/identity/organizations", json={"name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _register(
    client: AsyncClient,
    org_id: str | None,
    email: str,
    password: str = "securepass",
    role: str = "trainer",
) -> str:
    body: dict = {"email": email, "password": password, "role": role}
    if org_id is not None:
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


async def _auth_headers(
    client: AsyncClient, email: str, password: str = "securepass"
) -> dict:
    token = await _login(client, email, password)
    return {"Authorization": f"Bearer {token}"}


async def _set_org_pro(db_session: AsyncSession, org_id: str) -> None:
    await db_session.execute(
        update(Organization)
        .where(Organization.id == uuid.UUID(org_id))
        .values(plan="pro")
    )
    await db_session.commit()


async def _create_exercise(
    client: AsyncClient, headers: dict, name: str = "Squat"
) -> dict:
    resp = await client.post(
        "/api/v1/training/exercises",
        json={
            "name": name,
            "muscle_group": "quads",
            "equipment": "barbell",
            "movement_pattern": "squat",
            "is_bilateral": True,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _fake_openai_response(exercise_id: str):
    """Build a mock JSON-mode response (no tool_calls)."""
    payload = {
        "name": "AI Generated Program",
        "description": "Test program from AI",
        "mode": "program_driven",
        "days": [
            {
                "name": "Day 1",
                "position": 1,
                "day_tag": "full_body",
                "exercises": [
                    {
                        "exercise_id": exercise_id,
                        "position": 1,
                        "prescribed_sets": [
                            {
                                "position": 1,
                                "set_type": "working",
                                "rep_min": 5,
                                "rep_max": 8,
                                "rpe_target": 8.0,
                                "rest_seconds": 180,
                            }
                        ],
                    }
                ],
            }
        ],
    }
    message = SimpleNamespace(content=json.dumps(payload))
    choice = SimpleNamespace(message=message)
    return SimpleNamespace(choices=[choice])


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_program_happy_path(
    client: AsyncClient, db_session: AsyncSession
):
    org_id = await _make_org(client, "Pro Gym")
    await _register(client, org_id, "trainer@ai-test.com", role="trainer")
    headers = await _auth_headers(client, "trainer@ai-test.com")

    await _set_org_pro(db_session, org_id)

    exercise = await _create_exercise(client, headers)
    exercise_id = exercise["id"]

    fake_response = _fake_openai_response(exercise_id)

    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=fake_response)

    with (
        patch("modules.ai.services._make_client", return_value=mock_client),
        patch("core.config.settings.ai_api_key", "sk-test-key"),
    ):
        resp = await client.post(
            "/api/v1/ai/generate-program",
            json={"notes": "strength focus"},
            headers=headers,
        )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["name"] == "AI Generated Program"
    assert len(data["days"]) == 1
    assert data["days"][0]["name"] == "Day 1"
    assert len(data["days"][0]["exercises"]) == 1
    assert len(data["days"][0]["exercises"][0]["prescribed_sets"]) == 1


@pytest.mark.asyncio
async def test_generate_program_free_plan_returns_402(
    client: AsyncClient, db_session: AsyncSession
):
    org_id = await _make_org(client, "Free Gym")
    await _register(client, org_id, "trainer@free-test.com", role="trainer")
    headers = await _auth_headers(client, "trainer@free-test.com")

    # Force org back to free to test the gate
    await db_session.execute(
        update(Organization)
        .where(Organization.id == uuid.UUID(org_id))
        .values(plan="free")
    )
    await db_session.commit()

    with patch("core.config.settings.ai_api_key", "sk-test-key"):
        resp = await client.post(
            "/api/v1/ai/generate-program",
            json={},
            headers=headers,
        )

    assert resp.status_code == 402


@pytest.mark.asyncio
async def test_generate_program_no_api_key_returns_503(client: AsyncClient):
    org_id = await _make_org(client, "Key Gym")
    await _register(client, org_id, "trainer@nokey-test.com", role="trainer")
    headers = await _auth_headers(client, "trainer@nokey-test.com")

    with patch("core.config.settings.ai_api_key", ""):
        resp = await client.post(
            "/api/v1/ai/generate-program",
            json={},
            headers=headers,
        )

    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_generate_program_athlete_for_other_athlete_returns_403(
    client: AsyncClient, db_session: AsyncSession
):
    org_id = await _make_org(client, "Role Gym")
    await _register(client, org_id, "athlete.a@ai-test.com", role="athlete")
    athlete_b_id = await _register(client, org_id, "athlete.b@ai-test.com", role="athlete")

    await _set_org_pro(db_session, org_id)
    headers = await _auth_headers(client, "athlete.a@ai-test.com")

    with patch("core.config.settings.ai_api_key", "sk-test-key"):
        resp = await client.post(
            "/api/v1/ai/generate-program",
            json={"athlete_id": athlete_b_id},
            headers=headers,
        )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_generate_program_requires_auth(client: AsyncClient):
    resp = await client.post("/api/v1/ai/generate-program", json={})
    assert resp.status_code == 401
