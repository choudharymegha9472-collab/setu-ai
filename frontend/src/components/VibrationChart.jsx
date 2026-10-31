import {
  CartesianGrid, Line, ResponsiveContainer, Scatter, ComposedChart,
  Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";

export default function VibrationChart({ data }) {
  const rows = data.map((r) => ({
    t: new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    vibration: r.vibration_rms,
    anomaly: r.is_anomaly ? r.vibration_rms : null,
  }));
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={rows} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" minTickGap={40} />
          <YAxis unit=" mm/s" width={70} />
          <Tooltip />
          <ReferenceLine y={4.5} stroke="#f59e0b" strokeDasharray="4 4" label="warn" />
          <ReferenceLine y={7.1} stroke="#ef4444" strokeDasharray="4 4" label="high" />
          <Line type="monotone" dataKey="vibration" stroke="#2563eb" dot={false} strokeWidth={2} name="Vibration RMS" />
          <Scatter dataKey="anomaly" fill="#dc2626" name="Anomaly" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
