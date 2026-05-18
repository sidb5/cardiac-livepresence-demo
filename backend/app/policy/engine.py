from __future__ import annotations

from copy import deepcopy
from typing import Any

from .asset_profiles import ASSET_PROFILES


POLICY_OVERRIDES: dict[str, dict[str, Any]] = {}


def set_policy_override(asset_type: str, override: dict[str, Any]) -> dict[str, Any]:
    current = POLICY_OVERRIDES.setdefault(asset_type, {})
    current.update({k: v for k, v in override.items() if v is not None})
    return get_policy(asset_type, override.get("threat_level", "normal"))


def get_policy(asset_type: str, threat_level: str = "normal") -> dict[str, Any]:
    policy = deepcopy(ASSET_PROFILES[asset_type])
    policy.update(POLICY_OVERRIDES.get(asset_type, {}))
    if threat_level == "elevated":
        policy["live_threshold"] = min(0.96, policy["live_threshold"] + 0.05)
        policy["token_seconds"] = max(10, int(policy["token_seconds"] * 0.65))
    elif threat_level == "critical":
        policy["live_threshold"] = min(0.98, policy["live_threshold"] + 0.09)
        policy["identity_threshold"] = min(0.98, policy["identity_threshold"] + 0.06)
        policy["token_seconds"] = max(8, int(policy["token_seconds"] * 0.45))
    policy["threat_level"] = threat_level
    return policy


def evaluate_policy(features: dict[str, Any], asset_type: str, identity_mode: str, threat_level: str) -> dict[str, Any]:
    policy = get_policy(asset_type, threat_level)
    reasons: list[str] = []
    live_conf = features["live_presence_confidence"]
    identity_score = features["ecg_identity_score"]

    if features["ecg_quality"] < 0.45:
        reasons.append("ecg_quality_poor")
    if features.get("contact_plausibility") == "poor":
        reasons.append("signal_quality_degraded")
    if features["ppg_quality"] is not None and features["ppg_quality"] < 0.45:
        reasons.append("ppg_quality_poor")
    if policy["require_ppg"] and features["ecg_ppg_coupling_status"] == "ppg_missing":
        reasons.append("ppg_required_missing")
    elif features["ecg_ppg_coupling_status"] == "ppg_missing":
        reasons.append("ecg_only_degraded_mode")
    if features["ecg_ppg_coupling_status"] == "invalid":
        reasons.append("ecg_ppg_timing_invalid")
    if features["replay_risk"] >= 0.65:
        reasons.append("replay_pattern_detected")
    if features["synthetic_risk"] >= 0.65:
        reasons.append("synthetic_signal_risk")
    if identity_mode == "ecg_identity_live_presence" and identity_score < policy["identity_threshold"]:
        reasons.append("ecg_identity_mismatch")
    if features["duress_risk"] >= 0.7:
        reasons.append("covert_duress_flag")

    hard_denies = {
        "ecg_ppg_timing_invalid",
        "replay_pattern_detected",
        "synthetic_signal_risk",
        "ecg_identity_mismatch",
    }
    decision = "allow"

    if any(r in hard_denies for r in reasons):
        decision = "deny"
    elif live_conf < policy["live_threshold"]:
        decision = "step_up" if live_conf >= policy["live_threshold"] - 0.18 else "deny"
        reasons.append("live_presence_below_threshold")
    elif "ppg_required_missing" in reasons:
        decision = "step_up"
    elif "ecg_only_degraded_mode" in reasons and asset_type != "secure_door":
        decision = "limited"
    elif "covert_duress_flag" in reasons:
        decision = "limited"

    if decision == "allow":
        reasons.append("policy_allow")
    if decision in {"deny", "step_up"}:
        reasons.append(f"fail_secure:{policy['fail_secure']}")
    if decision == "limited":
        reasons.append("limited_access_policy")

    if asset_type == "classified_terminal" and decision == "allow":
        session_action = "maintain_active_session"
    elif decision == "deny":
        session_action = "terminate_or_fail_secure"
    elif decision == "step_up":
        session_action = "require_step_up_authentication"
    elif decision == "limited":
        session_action = "limit_or_hold_privileged_actions"
    else:
        session_action = "grant_access"

    return {
        "decision": decision,
        "confidence": round(live_conf, 3),
        "reason_codes": reasons,
        "policy": policy,
        "session_action": session_action,
        "duress_alert": features["duress_risk"] >= 0.7,
    }
