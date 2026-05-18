export type User = {
  id: string;
  display_name: string;
  role: string;
  ecg_template: Record<string, unknown>;
};

export type Asset = {
  id: string;
  name: string;
  asset_type: AssetType;
  risk_level: string;
  metadata_json: Record<string, unknown>;
};

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

export type AttemptResponse = {
  attempt_id: string;
  decision: string;
  confidence: number;
  reason_codes: string[];
  features: Record<string, any>;
  assertion: string;
  assertion_payload: Record<string, any>;
  adapter_outputs: Record<string, any>;
  traces: {
    time: number[];
    ecg: number[];
    ppg: number[] | null;
    r_peaks: number[];
    ppg_peaks: number[];
    raw_signal_persisted: boolean;
  };
};

