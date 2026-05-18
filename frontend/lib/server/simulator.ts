import { USER_PROFILES } from "./data";
import { seededRandom, uniform } from "./random";
import type { Scenario, SimulatedSignal } from "./types";

const SAMPLE_RATE_HZ = 125;
const DURATION_SECONDS = 8;

export function simulateSignal(userId: string, scenario: Scenario): SimulatedSignal {
  let profile = { ...USER_PROFILES[userId] };
  const rng = seededRandom(`${userId}:${scenario}`);

  if (scenario === "synthetic_spoof" || scenario === "replayed_ecg") profile = { ...USER_PROFILES["operator-027"] };
  if (scenario === "duress_deviation") {
    profile.hr += 38;
    profile.variability *= 0.35;
  }

  const total = SAMPLE_RATE_HZ * DURATION_SECONDS;
  const time = Array.from({ length: total }, (_, i) => round(i / SAMPLE_RATE_HZ, 3));
  const rrBase = 60 / profile.hr;
  const fixedRr = scenario === "replayed_ecg" || scenario === "synthetic_spoof";
  const rPeaks: number[] = [];
  let t = 0.65;
  while (t < DURATION_SECONDS - 0.35) {
    const jitter = fixedRr ? 0 : uniform(rng, -profile.variability, profile.variability);
    rPeaks.push(round(t, 4));
    t += Math.max(0.48, rrBase + jitter);
  }

  let noise = scenario === "poor_signal" ? 0.18 : scenario === "synthetic_spoof" ? 0.003 : 0.018;
  const ecg = time.map((x) => baseline(x, scenario) + uniform(rng, -noise, noise));
  for (const peak of rPeaks) {
    for (let i = 0; i < time.length; i++) {
      const x = time[i];
      ecg[i] += gaussian(x, peak - 0.16, 0.025, -0.09 * profile.r_amp);
      ecg[i] += gaussian(x, peak, profile.qrs_width / 4.4, profile.r_amp);
      ecg[i] += gaussian(x, peak + 0.045, 0.018, -0.16 * profile.r_amp);
      ecg[i] += gaussian(x, peak + 0.28, 0.065, profile.t_amp);
    }
  }

  let ppg: number[] | null = time.map((x) => 0.04 * Math.sin(2 * Math.PI * 0.25 * x));
  const ppgPeaks: number[] = [];
  if (scenario === "missing_ppg" || scenario === "live_ecg") {
    ppg = null;
  } else {
    rPeaks.forEach((peak, idx) => {
      let delay = 0.285 + uniform(rng, -0.028, 0.032);
      if (scenario === "bad_ecg_ppg_timing") delay = idx % 2 === 0 ? 0.075 : 0.62;
      if (scenario === "replayed_ecg" || scenario === "synthetic_spoof") delay = 0.3;
      const ppgPeak = peak + delay;
      if (ppgPeak < DURATION_SECONDS) {
        ppgPeaks.push(round(ppgPeak, 4));
        for (let i = 0; i < time.length; i++) {
          const x = time[i];
          ppg![i] += gaussian(x, ppgPeak, 0.07, 0.72);
          ppg![i] += gaussian(x, ppgPeak + 0.18, 0.11, 0.22);
        }
      }
    });
    const ppgNoise = scenario === "poor_signal" ? 0.16 : 0.015;
    ppg = ppg.map((v) => round(v + uniform(rng, -ppgNoise, ppgNoise), 4));
  }

  return {
    sample_rate_hz: SAMPLE_RATE_HZ,
    scenario,
    source_metadata: {
      provider: "nextjs_in_memory_simulated",
      sensor_id: "sensor-sim-ecg-ppg-001",
      attestation: "simulated_unsigned_metadata",
      raw_storage: "disabled_by_default",
    },
    time,
    ecg: ecg.map((v) => round(v, 4)),
    ppg,
    r_peaks: rPeaks,
    ppg_peaks: ppgPeaks,
  };
}

function gaussian(x: number, mu: number, sigma: number, amp: number) {
  return amp * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

function baseline(x: number, scenario: Scenario) {
  let wander = 0.03 * Math.sin(2 * Math.PI * 0.33 * x);
  if (scenario === "poor_signal") wander += 0.12 * Math.sin(2 * Math.PI * 1.7 * x);
  return wander;
}

function round(value: number, places: number) {
  return Number(value.toFixed(places));
}

