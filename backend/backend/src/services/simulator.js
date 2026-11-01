// Demo data so the dashboard works without real sensors.
const gauss = (sd) => {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
};
const uni = (a, b) => a + Math.random() * (b - a);

export function generate(sensors = 3, points = 300, stepMinutes = 1) {
  const end = Date.now();
  const start = end - stepMinutes * points * 60000;
  const out = [];
  for (let s = 0; s < sensors; s++) {
    const sid = `PUMP-${String(s + 1).padStart(2, "0")}`;
    const bv = uni(2, 3), bf = uni(48, 52), bt = uni(55, 65);
    const faultStart = s === 0 ? Math.floor(points * 0.7) : null; // sensor 1 develops a fault
    for (let i = 0; i < points; i++) {
      let v = bv + gauss(0.12), f = bf + gauss(0.3), t = bt + gauss(0.8);
      if (faultStart !== null && i >= faultStart) {
        const k = i - faultStart;
        v += 0.05 * k + (Math.random() < 0.15 ? uni(2, 5) : 0);
        f += 0.03 * k;
        t += 0.08 * k;
      } else if (Math.random() < 0.004) v += uni(3, 6); // rare blip on healthy sensors
      out.push({
        sensor_id: sid, ts: new Date(start + i * stepMinutes * 60000),
        vibration_rms: +Math.max(v, 0.05).toFixed(3), frequency_hz: +f.toFixed(2), temperature_c: +t.toFixed(1),
      });
    }
  }
  return out;
}
