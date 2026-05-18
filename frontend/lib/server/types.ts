export type AssetType =
  | "secure_door"
  | "classified_terminal"
  | "armory"
  | "vehicle"
  | "drone"
  | "command_console"
  | "critical_infrastructure";

export type Scenario =
  | "live_ecg"
  | "live_ecg_ppg"
  | "poor_signal"
  | "replayed_ecg"
  | "synthetic_spoof"
  | "missing_ppg"
  | "bad_ecg_ppg_timing"
  | "duress_deviation";

export type IdentityMode = "live_presence_only" | "ecg_identity_live_presence";

export type UserRecord = {
  id: string;
  display_name: string;
  role: string;
  ecg_template: Record<string, any>;
};

export type AssetRecord = {
  id: string;
  name: string;
  asset_type: AssetType;
  risk_level: string;
  metadata_json: Record<string, any>;
};

export type SimulatedSignal = {
  sample_rate_hz: number;
  scenario: Scenario;
  source_metadata: Record<string, any>;
  time: number[];
  ecg: number[];
  ppg: number[] | null;
  r_peaks: number[];
  ppg_peaks: number[];
};

