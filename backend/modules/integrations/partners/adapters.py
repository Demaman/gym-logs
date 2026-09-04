"""Per-platform adapter registry for wellness benefit integrations.

Each adapter knows the wire-format quirks of one external platform
(Wellhub, TotalPass, SESI, …).  Business logic lives in services.py;
adapters are pure data-extraction helpers.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PlatformAdapter:
    """Base adapter — override `extract_*` methods in subclasses."""

    platform: str
    signature_header: str
    outbound_url: str | None
    outbound_member_field: str
    outbound_gym_header: str | None

    def extract_external_id(self, payload: dict) -> str | None:
        raise NotImplementedError

    def extract_external_gym_id(self, payload: dict) -> str | None:
        raise NotImplementedError

    def extract_transaction_id(self, payload: dict) -> str | None:
        return payload.get("transaction_id")

    def extract_timestamp(self, payload: dict) -> str | None:
        raise NotImplementedError


class WellhubAdapter(PlatformAdapter):
    def extract_external_id(self, payload: dict) -> str | None:
        return payload.get("gympass_id")

    def extract_external_gym_id(self, payload: dict) -> str | None:
        return payload.get("gym_id")

    def extract_timestamp(self, payload: dict) -> str | None:
        return payload.get("timestamp")


class TotalPassAdapter(PlatformAdapter):
    def extract_external_id(self, payload: dict) -> str | None:
        return payload.get("member_id") or payload.get("user_id")

    def extract_external_gym_id(self, payload: dict) -> str | None:
        return payload.get("gym_id") or payload.get("unit_id")

    def extract_timestamp(self, payload: dict) -> str | None:
        return payload.get("timestamp") or payload.get("checkin_time")


class SesiAdapter(PlatformAdapter):
    def extract_external_id(self, payload: dict) -> str | None:
        return payload.get("cpf") or payload.get("member_id")

    def extract_external_gym_id(self, payload: dict) -> str | None:
        return payload.get("unit_id") or payload.get("gym_id")

    def extract_timestamp(self, payload: dict) -> str | None:
        return payload.get("timestamp") or payload.get("check_in_time")


_REGISTRY: dict[str, PlatformAdapter] = {
    "wellhub": WellhubAdapter(
        platform="wellhub",
        signature_header="X-Gympass-Signature",
        outbound_url="https://api.partners.gympass.com/access/v1/validate",
        outbound_member_field="gympass_id",
        outbound_gym_header="X-Gym-Id",
    ),
    "totalpass": TotalPassAdapter(
        platform="totalpass",
        signature_header="X-TotalPass-Signature",
        outbound_url="https://api.totalpass.com.br/v1/validate",
        outbound_member_field="member_id",
        outbound_gym_header="X-Gym-Id",
    ),
    "sesi": SesiAdapter(
        platform="sesi",
        signature_header="X-Sesi-Signature",
        outbound_url=None,
        outbound_member_field="cpf",
        outbound_gym_header=None,
    ),
}


def get_adapter(platform: str) -> PlatformAdapter | None:
    return _REGISTRY.get(platform.lower())


def supported_platforms() -> list[str]:
    return list(_REGISTRY)
