import type { AssetType, IdentityMode } from "./types";

const ASSET_PROFILES: Record<AssetType, any> = {
  secure_door: { live_threshold: 0.72, identity_threshold: 0.72, require_ppg: false, token_seconds: 45, fail_secure: "deny/relock" },
  classified_terminal: { live_threshold: 0.78, identity_threshold: 0.76, require_ppg: true, token_seconds: 30, fail_secure: "freeze_or_lock_session" },
  armory: { live_threshold: 0.84, identity_threshold: 0.8, require_ppg: true, token_seconds: 20, fail_secure: "relock_drawer_and_alert_supervisor" },
  vehicle: { live_threshold: 0.78, identity_threshold: 0.76, require_ppg: true, token_seconds: 25, fail_secure: "safe_stop_or_ignition_deny_simulation" },
  drone: { live_threshold: 0.82, identity_threshold: 0.78, require_ppg: true, token_seconds: 18, fail_secure: "return_to_home_or_command_hold_simulation" },
  command_console: { live_threshold: 0.86, identity_threshold: 0.82, require_ppg: true, token_seconds: 15, fail_secure: "command_hold_and_supervisor_approval" },
  critical_infrastructure: { live_threshold: 0.83, identity_threshold: 0.8, require_ppg: true, token_seconds: 20, fail_secure: "read_only_mode_or_command_quarantine" },
};

export function getPolicy(assetType: AssetType, threatLevel = "normal") {
  const policy = { ...ASSET_PROFILES[assetType], threat_level: threatLevel };
  if (threatLevel === "elevated") {
    policy.live_threshold = Math.min(0.96, policy.live_threshold + 0.05);
    policy.token_seconds = Math.max(10, Math.floor(policy.token_seconds * 0.65));
  }
  if (threatLevel === "critical") {
    policy.live_threshold = Math.min(0.98, policy.live_threshold + 0.09);
    policy.identity_threshold = Math.min(0.98, policy.identity_threshold + 0.06);
    policy.token_seconds = Math.max(8, Math.floor(policy.token_seconds * 0.45));
  }
  return policy;
}

export function evaluatePolicy(features: Record<string, any>, assetType: AssetType, identityMode: IdentityMode, threatLevel: string) {
  const policy = getPolicy(assetType, threatLevel);
  const reasons: string[] = [];
  const liveConf = features.live_presence_confidence;

  if (features.ecg_quality < 0.45) reasons.push("ecg_quality_poor");
  if (features.contact_plausibility === "poor") reasons.push("signal_quality_degraded");
  if (features.ppg_quality !== null && features.ppg_quality < 0.45) reasons.push("ppg_quality_poor");
  if (policy.require_ppg && features.ecg_ppg_coupling_status === "ppg_missing") reasons.push("ppg_required_missing");
  else if (features.ecg_ppg_coupling_status === "ppg_missing") reasons.push("ecg_only_degraded_mode");
  if (features.ecg_ppg_coupling_status === "invalid") reasons.push("ecg_ppg_timing_invalid");
  if (features.replay_risk >= 0.65) reasons.push("replay_pattern_detected");
  if (features.synthetic_risk >= 0.65) reasons.push("synthetic_signal_risk");
  if (identityMode === "ecg_identity_live_presence" && features.ecg_identity_score < policy.identity_threshold) reasons.push("ecg_identity_mismatch");
  if (features.duress_risk >= 0.7) reasons.push("covert_duress_flag");

  let decision = "allow";
  const hardDenies = ["ecg_ppg_timing_invalid", "replay_pattern_detected", "synthetic_signal_risk", "ecg_identity_mismatch"];
  if (reasons.some((r) => hardDenies.includes(r))) decision = "deny";
  else if (liveConf < policy.live_threshold) {
    decision = liveConf >= policy.live_threshold - 0.18 ? "step_up" : "deny";
    reasons.push("live_presence_below_threshold");
  } else if (reasons.includes("ppg_required_missing")) decision = "step_up";
  else if (reasons.includes("ecg_only_degraded_mode") && assetType !== "secure_door") decision = "limited";
  else if (reasons.includes("covert_duress_flag")) decision = "limited";

  if (decision === "allow") reasons.push("policy_allow");
  if (decision === "deny" || decision === "step_up") reasons.push(`fail_secure:${policy.fail_secure}`);
  if (decision === "limited") reasons.push("limited_access_policy");

  const session_action =
    assetType === "classified_terminal" && decision === "allow"
      ? "maintain_active_session"
      : decision === "deny"
        ? "terminate_or_fail_secure"
        : decision === "step_up"
          ? "require_step_up_authentication"
          : decision === "limited"
            ? "limit_or_hold_privileged_actions"
            : "grant_access";

  return { decision, confidence: Number(liveConf.toFixed(3)), reason_codes: reasons, policy, session_action, duress_alert: features.duress_risk >= 0.7 };
}

