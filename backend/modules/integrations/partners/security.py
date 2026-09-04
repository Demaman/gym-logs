import hashlib
import hmac
from datetime import UTC, datetime

_MAX_WEBHOOK_AGE_SECONDS = 300  # 5-minute replay window


def verify_signature(payload_bytes: bytes, signature_header: str, secret: str) -> bool:
    """Timing-safe HMAC-SHA256 verification.

    Header format: 'sha256=<hex>'. Verification is performed on raw bytes to
    prevent canonicalization attacks — never re-serialise the parsed JSON.
    """
    if not signature_header.startswith("sha256="):
        return False
    received = signature_header[7:]
    expected = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received)


def check_timestamp(timestamp_str: str) -> bool:
    """Reject webhooks older than 5 minutes to prevent replay attacks."""
    try:
        ts = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        age = datetime.now(UTC) - ts
        return abs(age.total_seconds()) <= _MAX_WEBHOOK_AGE_SECONDS
    except (ValueError, TypeError):
        return False
