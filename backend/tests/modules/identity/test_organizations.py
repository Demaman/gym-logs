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
        "/api/v1/identity/organizations",
        json={
            "name": "CrossFit Box",
            "cnpj": "12.345.678/0001-90",
            "phone": "+55 11 9 1234-5678",
            "contact_email": "hello@crossfitbox.com",
            "address_street": "Av. Paulista, 1000",
            "address_city": "São Paulo",
            "address_state": "SP",
            "address_zip": "01310-100",
            "website": "https://crossfitbox.com",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    required_keys = {"id", "name", "created_at"}
    optional_keys = {"cnpj", "phone", "contact_email", "address_street", "address_city", "address_state", "address_zip", "website"}
    assert required_keys <= set(data.keys())
    assert set(data.keys()) == required_keys | optional_keys
    assert data["cnpj"] == "12.345.678/0001-90"
    assert data["address_city"] == "São Paulo"
