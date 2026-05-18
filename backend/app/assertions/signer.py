from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from ..config import JWT_ISSUER, JWT_SIGNING_KEY


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def make_assertion_payload(
    *,
    attempt_id: str,
    user_id: str,
    asset_id: str,
    asset_type: str,
    identity_mode: str,
    features: dict[str, Any],
    policy_result: dict[str, Any],
) -> dict[str, Any]:
    issued = now_utc()
    expires = issued + timedelta(seconds=policy_result["policy"]["token_seconds"])
    return {
        "iss": JWT_ISSUER,
        "sub": user_id,
        "jti": attempt_id,
        "iat": int(issued.timestamp()),
        "exp": int(expires.timestamp()),
        "asset_id": asset_id,
        "asset_type": asset_type,
        "identity_mode": identity_mode,
        "live_presence_status": "pass" if policy_result["confidence"] >= policy_result["policy"]["live_threshold"] else "degraded",
        "confidence": policy_result["confidence"],
        "ecg_identity_match_status": features["ecg_identity_status"],
        "ecg_identity_score": features["ecg_identity_score"],
        "signal_quality_state": {
            "ecg": features["ecg_quality"],
            "ppg": features["ppg_quality"],
        },
        "ecg_ppg_coupling_state": features["ecg_ppg_coupling_status"],
        "sensor_source_metadata": features["source_metadata"],
        "policy_result": policy_result["decision"],
        "session_action": policy_result["session_action"],
        "duress_alert": policy_result["duress_alert"],
        "reason_codes": policy_result["reason_codes"],
    }


def sign_jwt(payload: dict[str, Any]) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = _b64(json.dumps(header, separators=(",", ":"), sort_keys=True).encode())
    encoded_payload = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    signing_input = f"{encoded_header}.{encoded_payload}".encode()
    signature = hmac.new(JWT_SIGNING_KEY.encode(), signing_input, hashlib.sha256).digest()
    return f"{encoded_header}.{encoded_payload}.{_b64(signature)}"


def verify_jwt(token: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
    except ValueError as exc:
        raise ValueError("malformed_assertion") from exc
    expected = hmac.new(JWT_SIGNING_KEY.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(_b64(expected), sig_b64):
        raise ValueError("invalid_signature")
    payload = json.loads(base64.urlsafe_b64decode(_pad(payload_b64)))
    if int(now_utc().timestamp()) >= int(payload["exp"]):
        raise ValueError("assertion_expired")
    return payload


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _pad(value: str) -> bytes:
    return (value + "=" * (-len(value) % 4)).encode()

