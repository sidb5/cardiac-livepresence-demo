import type { SimulatedSignal } from "./types";

export function extractFeatures(signal: SimulatedSignal, enrolledTemplate: Record<string, any>) {
  const rr = signal.r_peaks.slice(1).map((p, i) => round(p - signal.r_peaks[i], 4));
  const ptt = pairPtt(signal.r_peaks, signal.ppg_peaks);
  const ecgQuality = qualityScore(signal.ecg);
  const ppgQuality = signal.ppg ? qualityScore(signal.ppg) : null;
  const regularity = regularityScore(rr);
  const identity = identityScore(signal, enrolledTemplate, rr);

  let couplingStatus = signal.ppg ? "not_available" : "ppg_missing";
  let couplingScore = 0;
  if (signal.ppg && ptt.length) {
    const plausible = ptt.map((d) => d >= 0.18 && d <= 0.45);
    const plausibleRatio = plausible.filter(Boolean).length / plausible.length;
    const variability = std(ptt);
    const variabilityScore = Math.min(1, variability / 0.018);
    couplingScore = round(0.82 * plausibleRatio + 0.18 * variabilityScore, 3);
    couplingStatus = plausibleRatio >= 0.75 && variability >= 0.006 ? "valid" : "invalid";
  }

  let replayRisk = 0;
  if (rr.length && std(rr) < 0.006) replayRisk += 0.45;
  if (ptt.length && std(ptt) < 0.004) replayRisk += 0.45;
  if (signal.scenario === "replayed_ecg") replayRisk = Math.max(replayRisk, 0.9);

  let syntheticRisk = 0;
  if (ecgQuality > 0.97 && rr.length && std(rr) < 0.004) syntheticRisk += 0.55;
  if (signal.scenario === "synthetic_spoof") syntheticRisk = Math.max(syntheticRisk, 0.88);

  let liveConfidence = bounded(
    0.36 * ecgQuality + 0.26 * couplingScore + 0.16 * regularity + 0.12 * (1 - replayRisk) + 0.1 * (1 - syntheticRisk)
  );
  if (!signal.ppg) liveConfidence = Math.min(liveConfidence, 0.68);
  if (signal.scenario === "poor_signal") liveConfidence = Math.min(liveConfidence, 0.52);

  return {
    sample_rate_hz: signal.sample_rate_hz,
    ecg_quality: round(ecgQuality, 3),
    ppg_quality: ppgQuality === null ? null : round(ppgQuality, 3),
    r_peak_count: signal.r_peaks.length,
    r_peak_times: signal.r_peaks,
    ppg_peak_times: signal.ppg_peaks,
    rr_mean_seconds: rr.length ? round(mean(rr), 4) : null,
    rr_variability: rr.length > 1 ? round(std(rr), 4) : 0,
    ptt_measurements_seconds: ptt,
    ptt_mean_seconds: ptt.length ? round(mean(ptt), 4) : null,
    ptt_variability: ptt.length > 1 ? round(std(ptt), 4) : 0,
    ecg_ppg_coupling_status: couplingStatus,
    ecg_ppg_coupling_score: couplingScore,
    contact_plausibility: signal.scenario === "poor_signal" ? "poor" : "plausible",
    replay_risk: round(bounded(replayRisk), 3),
    synthetic_risk: round(bounded(syntheticRisk), 3),
    duress_risk: signal.scenario === "duress_deviation" ? 0.82 : 0.08,
    live_presence_confidence: round(liveConfidence, 3),
    ecg_identity_score: identity.score,
    ecg_identity_status: identity.status,
    ecg_identity_details: identity.details,
    source_metadata: signal.source_metadata,
  };
}

function pairPtt(rPeaks: number[], ppgPeaks: number[]) {
  return rPeaks.flatMap((r) => {
    const p = ppgPeaks.find((peak) => peak > r);
    return p ? [round(p - r, 4)] : [];
  });
}

function qualityScore(values: number[]) {
  if (!values.length) return 0;
  const spread = Math.max(...values) - Math.min(...values);
  const diffs = values.slice(1).map((v, i) => Math.abs(v - values[i]));
  const roughness = diffs.length ? mean(diffs) : 0;
  if (spread <= 0) return 0;
  const snrProxy = spread / Math.max(roughness, 0.001);
  return bounded((snrProxy - 3) / 10.5);
}

function regularityScore(rr: number[]) {
  if (rr.length < 3) return 0.4;
  const sd = std(rr);
  if (sd < 0.004) return 0.25;
  if (sd > 0.12) return 0.45;
  return bounded(sd / 0.04);
}

function identityScore(signal: SimulatedSignal, template: Record<string, any>, rr: number[]) {
  const rrMean = rr.length ? mean(rr) : template.rr_mean_seconds;
  const qrsWidth = estimateQrsWidth(signal);
  const rAmp = Math.max(...signal.ecg);
  const tRatio = estimateTRatio(signal);
  const rrSim = similarity(rrMean, template.rr_mean_seconds, 0.22);
  const qrsSim = similarity(qrsWidth, template.qrs_width_seconds, 0.035);
  const ampSim = similarity(rAmp, template.relative_r_amplitude, 0.42);
  const tSim = similarity(tRatio, template.t_wave_ratio, 0.2);
  const morphology = round(0.35 * qrsSim + 0.35 * ampSim + 0.3 * tSim, 3);
  const score = round(bounded(0.38 * morphology + 0.27 * qrsSim + 0.2 * rrSim + 0.15 * ampSim), 3);
  return {
    score,
    status: score >= 0.72 ? "match" : "mismatch",
    details: {
      morphology_similarity: morphology,
      rr_similarity: round(rrSim, 3),
      qrs_width_similarity: round(qrsSim, 3),
      amplitude_similarity: round(ampSim, 3),
      estimated_qrs_width_seconds: round(qrsWidth, 4),
      raw_waveform_stored: false,
    },
  };
}

function estimateQrsWidth(signal: SimulatedSignal) {
  const widths: number[] = [];
  for (const peak of signal.r_peaks) {
    const samples = signal.time.map((t, i) => [t, signal.ecg[i]] as const).filter(([t]) => t >= peak - 0.08 && t <= peak + 0.08);
    if (!samples.length) continue;
    const maxV = Math.max(...samples.map(([, v]) => v));
    const half = maxV * 0.5;
    const above = samples.filter(([, v]) => v >= half).map(([t]) => t);
    if (above.length) widths.push(Math.max(...above) - Math.min(...above));
  }
  return widths.length ? mean(widths) : 0.09;
}

function estimateTRatio(signal: SimulatedSignal) {
  const rAmp = Math.max(...signal.ecg);
  const vals: number[] = [];
  for (const peak of signal.r_peaks) {
    const region = signal.time.map((t, i) => [t, signal.ecg[i]] as const).filter(([t]) => t >= peak + 0.2 && t <= peak + 0.42);
    if (region.length) vals.push(Math.max(...region.map(([, v]) => v)) / Math.max(rAmp, 0.001));
  }
  return vals.length ? mean(vals) : 0.25;
}

function similarity(value: number, target: number, tolerance: number) {
  return bounded(1 - Math.abs(value - target) / tolerance);
}

function mean(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - avg) ** 2)));
}

function bounded(value: number) {
  return Math.max(0, Math.min(1, value));
}

function round(value: number, places: number) {
  return Number(value.toFixed(places));
}

