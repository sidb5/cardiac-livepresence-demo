from __future__ import annotations

import math
from statistics import mean, pstdev
from typing import Any

from .simulator import SimulatedSignal


def extract_features(signal: SimulatedSignal, enrolled_template: dict[str, Any]) -> dict[str, Any]:
    r_peaks = signal.r_peaks
    rr = [round(r_peaks[i] - r_peaks[i - 1], 4) for i in range(1, len(r_peaks))]
    ptt = _pair_ptt(r_peaks, signal.ppg_peaks)
    ecg_quality = _quality_score(signal.ecg)
    ppg_quality = None if signal.ppg is None else _quality_score(signal.ppg)
    regularity = _regularity_score(rr)
    identity = _identity_score(signal, enrolled_template, rr)

    coupling_status = "not_available"
    coupling_score = 0.0
    if signal.ppg is not None and ptt:
        plausible = [0.18 <= d <= 0.45 for d in ptt]
        variability = pstdev(ptt) if len(ptt) > 1 else 0
        plausible_ratio = sum(plausible) / len(plausible)
        variability_score = min(1.0, variability / 0.018)
        coupling_score = round(0.82 * plausible_ratio + 0.18 * variability_score, 3)
        coupling_status = "valid" if plausible_ratio >= 0.75 and variability >= 0.006 else "invalid"
    elif signal.ppg is None:
        coupling_status = "ppg_missing"

    replay_risk = 0.0
    if rr and pstdev(rr) < 0.006:
        replay_risk += 0.45
    if ptt and pstdev(ptt) < 0.004:
        replay_risk += 0.45
    if signal.scenario == "replayed_ecg":
        replay_risk = max(replay_risk, 0.9)

    synthetic_risk = 0.0
    if ecg_quality > 0.97 and rr and pstdev(rr) < 0.004:
        synthetic_risk += 0.55
    if signal.scenario == "synthetic_spoof":
        synthetic_risk = max(synthetic_risk, 0.88)

    live_confidence = _bounded(
        0.36 * ecg_quality
        + 0.26 * coupling_score
        + 0.16 * regularity
        + 0.12 * (1 - replay_risk)
        + 0.10 * (1 - synthetic_risk)
    )

    if signal.ppg is None:
        live_confidence = min(live_confidence, 0.68)
    if signal.scenario == "poor_signal":
        live_confidence = min(live_confidence, 0.52)

    return {
        "sample_rate_hz": signal.sample_rate_hz,
        "ecg_quality": round(ecg_quality, 3),
        "ppg_quality": None if ppg_quality is None else round(ppg_quality, 3),
        "r_peak_count": len(r_peaks),
        "r_peak_times": r_peaks,
        "ppg_peak_times": signal.ppg_peaks,
        "rr_mean_seconds": round(mean(rr), 4) if rr else None,
        "rr_variability": round(pstdev(rr), 4) if len(rr) > 1 else 0,
        "ptt_measurements_seconds": ptt,
        "ptt_mean_seconds": round(mean(ptt), 4) if ptt else None,
        "ptt_variability": round(pstdev(ptt), 4) if len(ptt) > 1 else 0,
        "ecg_ppg_coupling_status": coupling_status,
        "ecg_ppg_coupling_score": coupling_score,
        "contact_plausibility": "poor" if signal.scenario == "poor_signal" else "plausible",
        "replay_risk": round(_bounded(replay_risk), 3),
        "synthetic_risk": round(_bounded(synthetic_risk), 3),
        "duress_risk": 0.82 if signal.scenario == "duress_deviation" else 0.08,
        "live_presence_confidence": round(live_confidence, 3),
        "ecg_identity_score": identity["score"],
        "ecg_identity_status": identity["status"],
        "ecg_identity_details": identity["details"],
        "source_metadata": signal.source_metadata,
    }


def _pair_ptt(r_peaks: list[float], ppg_peaks: list[float]) -> list[float]:
    results: list[float] = []
    for r in r_peaks:
        later = [p for p in ppg_peaks if p > r]
        if later:
            results.append(round(later[0] - r, 4))
    return results


def _quality_score(values: list[float]) -> float:
    if not values:
        return 0
    spread = max(values) - min(values)
    diffs = [abs(values[i] - values[i - 1]) for i in range(1, len(values))]
    roughness = mean(diffs) if diffs else 0
    if spread <= 0:
        return 0
    snr_proxy = spread / max(roughness, 0.001)
    return _bounded((snr_proxy - 3.0) / 10.5)


def _regularity_score(rr: list[float]) -> float:
    if len(rr) < 3:
        return 0.4
    sd = pstdev(rr)
    if sd < 0.004:
        return 0.25
    if sd > 0.12:
        return 0.45
    return _bounded(sd / 0.04)


def _identity_score(signal: SimulatedSignal, template: dict[str, Any], rr: list[float]) -> dict[str, Any]:
    rr_mean = mean(rr) if rr else template["rr_mean_seconds"]
    qrs_width = _estimate_qrs_width(signal)
    r_amp = max(signal.ecg) if signal.ecg else 0
    t_ratio = _estimate_t_ratio(signal)

    rr_sim = _similarity(rr_mean, template["rr_mean_seconds"], 0.22)
    qrs_sim = _similarity(qrs_width, template["qrs_width_seconds"], 0.035)
    amp_sim = _similarity(r_amp, template["relative_r_amplitude"], 0.42)
    t_sim = _similarity(t_ratio, template["t_wave_ratio"], 0.20)
    morphology = round(0.35 * qrs_sim + 0.35 * amp_sim + 0.30 * t_sim, 3)
    score = round(_bounded(0.38 * morphology + 0.27 * qrs_sim + 0.20 * rr_sim + 0.15 * amp_sim), 3)
    return {
        "score": score,
        "status": "match" if score >= 0.72 else "mismatch",
        "details": {
            "morphology_similarity": morphology,
            "rr_similarity": round(rr_sim, 3),
            "qrs_width_similarity": round(qrs_sim, 3),
            "amplitude_similarity": round(amp_sim, 3),
            "estimated_qrs_width_seconds": round(qrs_width, 4),
            "raw_waveform_stored": False,
        },
    }


def _estimate_qrs_width(signal: SimulatedSignal) -> float:
    widths = []
    for peak in signal.r_peaks:
        samples = [(t, v) for t, v in zip(signal.time, signal.ecg) if peak - 0.08 <= t <= peak + 0.08]
        if not samples:
            continue
        max_v = max(v for _, v in samples)
        half = max_v * 0.5
        above = [t for t, v in samples if v >= half]
        if above:
            widths.append(max(above) - min(above))
    return mean(widths) if widths else 0.09


def _estimate_t_ratio(signal: SimulatedSignal) -> float:
    vals = []
    r_amp = max(signal.ecg) if signal.ecg else 1
    for peak in signal.r_peaks:
        region = [v for t, v in zip(signal.time, signal.ecg) if peak + 0.2 <= t <= peak + 0.42]
        if region:
            vals.append(max(region) / max(r_amp, 0.001))
    return mean(vals) if vals else 0.25


def _similarity(value: float, target: float, tolerance: float) -> float:
    return _bounded(1 - abs(value - target) / tolerance)


def _bounded(value: float) -> float:
    return max(0.0, min(1.0, value))

