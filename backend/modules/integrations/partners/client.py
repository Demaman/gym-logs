import httpx

from modules.integrations.partners.adapters import PlatformAdapter


class PartnerClient:
    """Generic outbound validation client — delegates wire-format to the adapter."""

    async def validate_member(
        self,
        adapter: PlatformAdapter,
        external_member_id: str,
        bearer_token: str,
        external_gym_id: str,
    ) -> dict | None:
        """Call the platform API to verify the member is active.

        Returns the parsed response dict on HTTP 200, or None if the member
        is not found, the platform has no outbound URL, or the call fails.
        """
        if not adapter.outbound_url:
            # Platform (e.g. SESI) is webhook-only — no outbound validation API
            return None

        headers: dict[str, str] = {"Authorization": f"Bearer {bearer_token}"}
        if adapter.outbound_gym_header:
            headers[adapter.outbound_gym_header] = external_gym_id

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                adapter.outbound_url,
                json={adapter.outbound_member_field: external_member_id},
                headers=headers,
            )

        return resp.json() if resp.status_code == 200 else None
