from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


AssetType = Literal[
    "secure_door",
    "classified_terminal",
    "armory",
    "vehicle",
    "drone",
    "command_console",
    "critical_infrastructure",
]

Scenario = Literal[
    "live_ecg",
    "live_ecg_ppg",
    "poor_signal",
    "replayed_ecg",
    "synthetic_spoof",
    "missing_ppg",
    "bad_ecg_ppg_timing",
    "duress_deviation",
]

IdentityMode = Literal["live_presence_only", "ecg_identity_live_presence"]


class UserOut(BaseModel):
    id: str
    display_name: str
    role: str
    ecg_template: dict[str, Any]


class AssetOut(BaseModel):
    id: str
    name: str
    asset_type: AssetType
    risk_level: str
    metadata_json: dict[str, Any]


class PolicyConfigIn(BaseModel):
    asset_type: AssetType
    threat_level: Literal["normal", "elevated", "critical"] = "normal"
    require_ppg: bool | None = None
    live_threshold: float | None = Field(default=None, ge=0, le=1)
    identity_threshold: float | None = Field(default=None, ge=0, le=1)


class AttemptRequest(BaseModel):
    user_id: str
    asset_id: str
    scenario: Scenario
    identity_mode: IdentityMode = "live_presence_only"
    threat_level: Literal["normal", "elevated", "critical"] = "normal"
    adapter_mode: Literal["all", "rest", "wiegand", "osdp", "relay", "zero_trust", "offline"] = "all"


class AttemptResponse(BaseModel):
    attempt_id: str
    decision: str
    confidence: float
    reason_codes: list[str]
    features: dict[str, Any]
    assertion: str
    assertion_payload: dict[str, Any]
    adapter_outputs: dict[str, Any]
    traces: dict[str, Any]

