import type { AssetRecord, UserRecord } from "./types";

export const USER_PROFILES: Record<string, Record<string, number>> = {
  "operator-014": { hr: 70, qrs_width: 0.082, r_amp: 1.05, t_amp: 0.24, variability: 0.035 },
  "operator-027": { hr: 82, qrs_width: 0.094, r_amp: 0.92, t_amp: 0.32, variability: 0.022 },
  "supervisor-003": { hr: 62, qrs_width: 0.076, r_amp: 1.18, t_amp: 0.21, variability: 0.045 },
};

export function enrollmentTemplate(userId: string) {
  const profile = USER_PROFILES[userId];
  const derivedQrsWidth = profile.qrs_width / 2.35;
  return {
    template_version: "sim-derived-v1",
    rr_mean_seconds: round(60 / profile.hr, 4),
    rr_variability: profile.variability,
    qrs_width_seconds: round(derivedQrsWidth, 4),
    relative_r_amplitude: profile.r_amp,
    t_wave_ratio: profile.t_amp,
    morphology_vector: [profile.r_amp, round(derivedQrsWidth, 4), profile.t_amp, profile.hr / 100, profile.variability],
    raw_waveform_stored: false,
  };
}

export const users: UserRecord[] = Object.keys(USER_PROFILES).map((id) => ({
  id,
  display_name: id.replaceAll("-", " ").replace(/\b\w/g, (m) => m.toUpperCase()),
  role: id.startsWith("supervisor") ? "supervisor" : "operator",
  ecg_template: enrollmentTemplate(id),
}));

export const assets: AssetRecord[] = [
  ["door-main-scif", "SCIF Door Reader", "secure_door", "standard"],
  ["terminal-alpha", "Classified Terminal Alpha", "classified_terminal", "high"],
  ["armory-drawer-2", "Armory Drawer 2", "armory", "critical"],
  ["vehicle-gate-7", "Secure Vehicle Gate 7", "vehicle", "high"],
  ["drone-console-raven", "Drone Console Raven", "drone", "critical"],
  ["command-console-1", "Command Console 1", "command_console", "critical"],
  ["water-plant-hmi", "Water Plant HMI", "critical_infrastructure", "critical"],
].map(([id, name, asset_type, risk_level]) => ({
  id,
  name,
  asset_type: asset_type as AssetRecord["asset_type"],
  risk_level,
  metadata_json: { integration: "simulated", production_certified: false },
}));

function round(value: number, places: number) {
  return Number(value.toFixed(places));
}

