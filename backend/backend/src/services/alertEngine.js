// Decides whether a reading is unusual and whether it needs a maintenance alert.
// `evaluate` is pure (works on an in-memory state), so it can be unit-tested without MongoDB.
import { robustZ, severityFromVibration, severityFromZ, worst } from "./analysis.js";
import { config } from "../config/index.js";

export const BASELINE_N = 100;
export const DEDUP_MS = 10 * 60 * 1000;

export const newState = () => ({ vib: [], freq: [], lastAlertAt: {} });

const push = (arr, v) => {
  if (v === null || v === undefined) return;
  arr.push(v);
  if (arr.length > BASELINE_N) arr.shift();
};

/**
 * @param r      { sensor_id, ts: Date, vibration_rms, frequency_hz?, temperature_c? }
 * @param state  per-sensor state (baseline of normal values + time of last open alert per type)
 * @returns      { z_score, is_anomaly, alerts: [alertDoc] }  and mutates `state`
 */
export function evaluate(r, state, t = config.thresholds) {
  const alerts = [];
  const tsMs = r.ts.getTime();
  const raise = (severity, type, message, value, z) => {
    const last = state.lastAlertAt[type];
    if (last !== undefined && tsMs - last < DEDUP_MS) return; // avoid alert spam
    state.lastAlertAt[type] = tsMs;
    alerts.push({ sensor_id: r.sensor_id, ts: r.ts, severity, type, message, value, z_score: z, status: "open" });
  };

  const zVib = robustZ(r.vibration_rms, state.vib);
  const zFreq = r.frequency_hz != null ? robustZ(r.frequency_hz, state.freq) : null;

  // 1) vibration level + sudden increase vs this sensor's own normal
  const sevAbs = severityFromVibration(r.vibration_rms, t);
  const sevZ = zVib !== null && zVib > 0 ? severityFromZ(zVib) : null; // only increases matter
  const sev = worst(sevAbs, sevZ);
  if (sev) {
    const why = [];
    if (sevAbs) why.push(`level ${r.vibration_rms.toFixed(2)} mm/s is above the safe band`);
    if (sevZ) why.push(`${zVib.toFixed(1)}x robust-sigma above this sensor's normal`);
    raise(sev, sevAbs && !sevZ ? "high_vibration" : "unusual_vibration",
      `${r.sensor_id}: vibration ${why.join("; ")}. Schedule an inspection.`, r.vibration_rms, zVib);
  }

  // 2) frequency shift (looseness / misalignment / bearing wear)
  const fSev = severityFromZ(zFreq);
  if (fSev) {
    raise(fSev, "frequency_shift",
      `${r.sensor_id}: dominant frequency moved to ${r.frequency_hz.toFixed(1)} Hz (${zFreq >= 0 ? "+" : ""}${zFreq.toFixed(1)} sigma from normal). Check alignment / bearings.`,
      r.frequency_hz, zFreq);
  }

  // 3) temperature limit
  if (r.temperature_c != null && r.temperature_c >= t.tempLimit) {
    raise(r.temperature_c >= t.tempLimit + 15 ? "critical" : "high", "high_temperature",
      `${r.sensor_id}: temperature ${r.temperature_c.toFixed(1)} C exceeds ${t.tempLimit} C. Inspect lubrication / cooling.`,
      r.temperature_c, null);
  }

  const is_anomaly = Boolean(sev || fSev);
  if (!is_anomaly) { // only learn from normal data so faults don't become the new "normal"
    push(state.vib, r.vibration_rms);
    push(state.freq, r.frequency_hz);
  }
  return { z_score: zVib, is_anomaly, alerts };
}
