from __future__ import annotations

from typing import Any


def run_adapters(policy_result: dict[str, Any], assertion: str, asset_type: str, mode: str = "all") -> dict[str, Any]:
    decision = policy_result["decision"]
    outputs = {
        "rest": {
            "type": "rest_api_decision",
            "decision": decision,
            "assertion_present": True,
            "production_note": "API shape is suitable for integration; this MVP endpoint is not a certified deployment.",
        },
        "wiegand": {
            "type": "wiegand_style_simulation",
            "line_state": "grant_pulse" if decision == "allow" else "deny_no_pulse",
            "production_note": "Wiegand behavior is simulated only; real installs require a certified access-control integrator.",
        },
        "osdp": {
            "type": "osdp_secure_reader_simulation",
            "message": "ACURXS_GRANT" if decision == "allow" else "ACURXS_DENY_OR_HOLD",
            "production_note": "OSDP message flow is simulated only; use certified OSDP components and integrator validation.",
        },
        "relay": {
            "type": "dry_contact_relay_simulation",
            "relay": "energized_unlock" if decision == "allow" else "deenergized_fail_secure",
            "asset_response": _asset_response(asset_type, decision),
        },
        "zero_trust": {
            "type": "zero_trust_token_handoff_simulation",
            "claim": "live_presence_assertion",
            "jwt_preview": assertion[:64] + "...",
            "policy_result": decision,
        },
        "offline": {
            "type": "local_only_mode",
            "cloud_required": False,
            "raw_signal_exported": False,
        },
    }
    if mode == "all":
        return outputs
    return {mode: outputs[mode]}


def _asset_response(asset_type: str, decision: str) -> str:
    if decision == "allow":
        return "allow_requested_access"
    return {
        "secure_door": "deny_or_relock",
        "classified_terminal": "freeze_or_lock_session",
        "armory": "relock_drawer_and_alert_supervisor",
        "vehicle": "safe_stop_or_ignition_deny_simulation",
        "drone": "return_to_home_or_command_hold_simulation",
        "command_console": "command_hold_and_supervisor_approval",
        "critical_infrastructure": "read_only_mode_or_command_quarantine",
    }[asset_type]

