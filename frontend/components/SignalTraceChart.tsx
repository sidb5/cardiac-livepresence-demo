"use client";

type Props = {
  title: string;
  time: number[];
  values: number[] | null;
  markers: number[];
  color: string;
};

export function SignalTraceChart({ title, time, values, markers, color }: Props) {
  const width = 760;
  const height = 150;
  if (!values) {
    return (
      <div className="chartEmpty">
        <strong>{title}</strong>
        <span>No signal present in this scenario</span>
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (t: number) => (t / Math.max(...time)) * width;
  const y = (v: number) => height - ((v - min) / Math.max(max - min, 0.001)) * (height - 18) - 9;
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(time[i]).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div className="chartPanel">
      <div className="chartTitle">{title}</div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        {markers.map((m) => (
          <line key={m} x1={x(m)} x2={x(m)} y1="8" y2={height - 8} stroke="rgba(255,255,255,.24)" strokeDasharray="4 4" />
        ))}
      </svg>
    </div>
  );
}

