from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Any


SAMPLE_RATE_HZ = 125
DURATION_SECONDS = 8


USER_PROFILES: dict[str, dict[str, float]] = {
    "operator-014": {"hr": 70, "qrs_width": 0.082, "r_amp": 1.05, "t_amp": 0.24, "variability": 0.035},
    "operator-027": {"hr": 82, "qrs_width": 0.094, "r_amp": 0.92, "t_amp": 0.32, "variability": 0.022},
    "supervisor-003": {"hr": 62, "qrs_width": 0.076, "r_amp": 1.18, "t_amp": 0.21, "variability": 0.045},
}


@dataclass(frozen=True)
class SimulatedSignal:
    sample_rate_hz: int
    scenario: str
    source_metadata: dict[str, Any]
    time: list[float]
    ecg: list[float]
    ppg: list[float] | None
    r_peaks: list[float]
    ppg_peaks: list[float]


def enrollment_template(user_id: str) -> dict[str, Any]:
    profile = USER_PROFILES[user_id]
    derived_qrs_width = profile["qrs_width"] / 2.35
    morphology = [
        round(profile["r_amp"], 4),
        round(derived_qrs_width, 4),
        round(profile["t_amp"], 4),
        round(profile["hr"] / 100, 4),
        round(profile["variability"], 4),
    ]
    return {
        "template_version": "sim-derived-v1",
        "rr_mean_seconds": round(60 / profile["hr"], 4),
        "rr_variability": profile["variability"],
        "qrs_width_seconds": round(derived_qrs_width, 4),
        "relative_r_amplitude": profile["r_amp"],
        "t_wave_ratio": profile["t_amp"],
        "morphology_vector": morphology,
        "raw_waveform_stored": False,
    }


def simulate_signal(user_id: str, scenario: str) -> SimulatedSignal:
    profile = dict(USER_PROFILES.get(user_id, USER_PROFILES["operator-014"]))
    rng = random.Random(f"{user_id}:{scenario}")

    if scenario in {"synthetic_spoof", "replayed_ecg"}:
        profile = dict(USER_PROFILES["operator-027"])
    if scenario == "duress_deviation":
        profile["hr"] += 38
        profile["variability"] *= 0.35

    total = SAMPLE_RATE_HZ * DURATION_SECONDS
    time = [i / SAMPLE_RATE_HZ for i in range(total)]
    rr_base = 60.0 / profile["hr"]
    r_peaks: list[float] = []
    t = 0.65
    fixed_rr = scenario in {"replayed_ecg", "synthetic_spoof"}
    while t < DURATION_SECONDS - 0.35:
        jitter = 0 if fixed_rr else rng.uniform(-profile["variability"], profile["variability"])
        r_peaks.append(round(t, 4))
        t += max(0.48, rr_base + jitter)

    noise = 0.018
    if scenario == "poor_signal":
        noise = 0.18
    if scenario == "synthetic_spoof":
        noise = 0.003

    ecg = [_baseline(x, scenario) + rng.uniform(-noise, noise) for x in time]
    for peak in r_peaks:
        for i, x in enumerate(time):
            ecg[i] += _gaussian(x, peak - 0.16, 0.025, -0.09 * profile["r_amp"])
            ecg[i] += _gaussian(x, peak, profile["qrs_width"] / 4.4, profile["r_amp"])
            ecg[i] += _gaussian(x, peak + 0.045, 0.018, -0.16 * profile["r_amp"])
            ecg[i] += _gaussian(x, peak + 0.28, 0.065, profile["t_amp"])

    ppg: list[float] | None = [0.04 * math.sin(2 * math.pi * 0.25 * x) for x in time]
    ppg_peaks: list[float] = []
    if scenario == "missing_ppg" or scenario == "live_ecg":
        ppg = None
    else:
        for idx, peak in enumerate(r_peaks):
            delay = 0.285 + rng.uniform(-0.028, 0.032)
            if scenario == "bad_ecg_ppg_timing":
                delay = 0.075 if idx % 2 == 0 else 0.62
            if scenario in {"replayed_ecg", "synthetic_spoof"}:
                delay = 0.300
            ppg_peak = peak + delay
            if ppg_peak < DURATION_SECONDS:
                ppg_peaks.append(round(ppg_peak, 4))
                for i, x in enumerate(time):
                    ppg[i] += _gaussian(x, ppg_peak, 0.07, 0.72)
                    ppg[i] += _gaussian(x, ppg_peak + 0.18, 0.11, 0.22)
        ppg_noise = 0.015 if scenario != "poor_signal" else 0.16
        ppg = [v + rng.uniform(-ppg_noise, ppg_noise) for v in ppg]

    return SimulatedSignal(
        sample_rate_hz=SAMPLE_RATE_HZ,
        scenario=scenario,
        source_metadata={
            "provider": "simulated",
            "sensor_id": "sensor-sim-ecg-ppg-001",
            "attestation": "simulated_unsigned_metadata",
            "raw_storage": "disabled_by_default",
        },
        time=[round(x, 3) for x in time],
        ecg=[round(v, 4) for v in ecg],
        ppg=None if ppg is None else [round(v, 4) for v in ppg],
        r_peaks=r_peaks,
        ppg_peaks=ppg_peaks,
    )


def _gaussian(x: float, mu: float, sigma: float, amp: float) -> float:
    return amp * math.exp(-0.5 * ((x - mu) / sigma) ** 2)


def _baseline(x: float, scenario: str) -> float:
    wander = 0.03 * math.sin(2 * math.pi * 0.33 * x)
    if scenario == "poor_signal":
        wander += 0.12 * math.sin(2 * math.pi * 1.7 * x)
    return wander
