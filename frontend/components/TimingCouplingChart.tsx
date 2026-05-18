"use client";

export function TimingCouplingChart({ rPeaks, ppgPeaks }: { rPeaks: number[]; ppgPeaks: number[] }) {
  const pairs = rPeaks
    .map((r) => {
      const p = ppgPeaks.find((peak) => peak > r);
      return p ? { r, p, d: +(p - r).toFixed(3) } : null;
    })
    .filter(Boolean) as { r: number; p: number; d: number }[];
  return (
    <div className="coupling">
      <div className="chartTitle">ECG-to-PPG Timing</div>
      {pairs.length === 0 ? (
        <div className="muted">No coupled PPG pulses available.</div>
      ) : (
        <div className="timingRows">
          {pairs.slice(0, 8).map((pair, index) => (
            <div className="timingRow" key={`${pair.r}-${index}`}>
              <span>Beat {index + 1}</span>
              <div className="timingTrack">
                <i style={{ left: "8%" }} />
                <b style={{ left: `${Math.min(92, 8 + pair.d * 180)}%` }} />
              </div>
              <code>{Math.round(pair.d * 1000)} ms</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

