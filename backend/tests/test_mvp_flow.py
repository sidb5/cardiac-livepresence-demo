from __future__ import annotations

import base64
import json
import time

from app.assertions.signer import sign_jwt


def attempt(client, scenario: str, asset_id: str = "armory-drawer-2", identity_mode: str = "ecg_identity_live_presence"):
    response = client.post(
        "/attempts",
        json={
            "user_id": "operator-014",
            "asset_id": asset_id,
            "scenario": scenario,
            "identity_mode": identity_mode,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_valid_live_ecg_ppg_allow_case(client):
    data = attempt(client, "live_ecg_ppg", "door-main-scif")
    assert data["decision"] == "allow"
    assert data["features"]["ecg_ppg_coupling_status"] == "valid"
    assert data["features"]["ecg_identity_status"] == "match"
    assert data["traces"]["raw_signal_persisted"] is False


def test_ecg_only_secure_door_can_allow_but_high_risk_steps_up(client):
    door = attempt(client, "live_ecg", "door-main-scif", "live_presence_only")
    terminal = attempt(client, "live_ecg", "terminal-alpha", "live_presence_only")
    assert door["decision"] in {"allow", "step_up"}
    assert terminal["decision"] in {"step_up", "deny", "limited"}
    assert "ppg_required_missing" in terminal["reason_codes"]


def test_missing_ppg_step_up_or_deny(client):
    data = attempt(client, "missing_ppg", "armory-drawer-2")
    assert data["decision"] in {"step_up", "deny"}
    assert "ppg_required_missing" in data["reason_codes"]


def test_bad_ecg_ppg_timing_denies(client):
    data = attempt(client, "bad_ecg_ppg_timing")
    assert data["decision"] == "deny"
    assert "ecg_ppg_timing_invalid" in data["reason_codes"]


def test_replay_signal_denies(client):
    data = attempt(client, "replayed_ecg")
    assert data["decision"] == "deny"
    assert "replay_pattern_detected" in data["reason_codes"]


def test_poor_signal_steps_up_or_denies(client):
    data = attempt(client, "poor_signal", "terminal-alpha")
    assert data["decision"] in {"step_up", "deny"}
    assert (
        "live_presence_below_threshold" in data["reason_codes"]
        or "ecg_quality_poor" in data["reason_codes"]
        or "signal_quality_degraded" in data["reason_codes"]
    )


def test_expired_assertion_denies_verification(client):
    token = sign_jwt({"iss": "test", "sub": "operator-014", "jti": "expired", "iat": int(time.time()) - 20, "exp": int(time.time()) - 1})
    response = client.post("/assertions/verify", json={"assertion": token})
    assert response.status_code == 401
    assert response.json()["detail"] == "assertion_expired"


def test_tampered_assertion_denies_verification(client):
    data = attempt(client, "live_ecg_ppg", "door-main-scif")
    parts = data["assertion"].split(".")
    payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
    payload["policy_result"] = "allow" if payload["policy_result"] != "allow" else "deny"
    parts[1] = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    response = client.post("/assertions/verify", json={"assertion": ".".join(parts)})
    assert response.status_code == 401
    assert response.json()["detail"] == "invalid_signature"


def test_asset_specific_fail_secure_case(client):
    data = attempt(client, "bad_ecg_ppg_timing", "drone-console-raven")
    assert data["decision"] == "deny"
    relay = data["adapter_outputs"]["relay"]
    assert relay["asset_response"] == "return_to_home_or_command_hold_simulation"


def test_duress_flag_case(client):
    data = attempt(client, "duress_deviation", "command-console-1")
    assert data["assertion_payload"]["duress_alert"] is True
    assert "covert_duress_flag" in data["reason_codes"]


def test_air_gapped_local_only_mode(client):
    data = attempt(client, "live_ecg_ppg", "door-main-scif")
    assert data["adapter_outputs"]["offline"]["cloud_required"] is False
    assert data["adapter_outputs"]["offline"]["raw_signal_exported"] is False
    audit = client.get("/audit").json()
    assert audit["chain"]["valid"] is True
