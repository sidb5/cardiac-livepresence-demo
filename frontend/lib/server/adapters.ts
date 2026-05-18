import type { AssetType } from "./types";

export function runAdapters(policyResult: Record<string, any>, assertion: string, assetType: AssetType) {
  const decision = policyResult.decision;
  return {
    rest: {
      type: "rest_api_decision",
      decision,
      assertion_present: true,
      production_note: "API shape is suitable for integration; this MVP endpoint is not a certified deployment.",
    },
    wiegand: {
      type: "wiegand_style_simulation",
      line_state: decision === "allow" ? "grant_pulse" : "deny_no_pulse",
      production_note: "Wiegand behavior is simulated only; real installs require a certified access-control integrator.",
    },
    osdp: {
      type: "osdp_secure_reader_simulation",
      message: decision === "allow" ? "ACURXS_GRANT" : "ACURXS_DENY_OR_HOLD",
      production_note: "OSDP message flow is simulated only; use certified OSDP components and integrator validation.",
    },
    relay: {
      type: "dry_contact_relay_simulation",
      relay: decision === "allow" ? "energized_unlock" : "deenergized_fail_secure",
      asset_response: assetResponse(assetType, decision),
    },
    zero_trust: {
      type: "zero_trust_token_handoff_simulation",
      claim: "live_presence_assertion",
      jwt_preview: `${assertion.slice(0, 64)}...`,
      policy_result: decision,
    },
    offline: {
      type: "local_only_mode",
      cloud_required: false,
      raw_signal_exported: false,
    },
  };
}

function assetResponse(assetType: AssetType, decision: string) {
  if (decision === "allow") return "allow_requested_access";
  return {
    secure_door: "deny_or_relock",
    classified_terminal: "freeze_or_lock_session",
    armory: "relock_drawer_and_alert_supervisor",
    vehicle: "safe_stop_or_ignition_deny_simulation",
    drone: "return_to_home_or_command_hold_simulation",
    command_console: "command_hold_and_supervisor_approval",
    critical_infrastructure: "read_only_mode_or_command_quarantine",
  }[assetType];
}

