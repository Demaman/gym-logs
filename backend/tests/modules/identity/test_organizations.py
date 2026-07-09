import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_organization(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/identity/organizations", json={"name": "Iron Gym"}
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Iron Gym"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_organization_returns_correct_shape(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/identity/organizations", json={"name": "CrossFit Box"}
    )
    assert resp.status_code == 201
    data = resp.json()
    assert set(data.keys()) == {"id", "name", "created_at"}
