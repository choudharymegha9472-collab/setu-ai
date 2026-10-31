import { Reading } from "../models/Reading.js";
import { Alert } from "../models/Alert.js";
import { evaluate, newState, BASELINE_N } from "./alertEngine.js";

/** Normalise + validate one incoming reading. Throws Error with a readable message. */
export function normalise(raw) {
  const sensor_id = String(raw.sensor_id ?? "").trim();
  if (!sensor_id) throw new Error("sensor_id is required");
  const vibration_rms = Number(raw.vibration_rms);
  if (raw.vibration_rms === "" || raw.vibration_rms == null || !Number.isFinite(vibration_rms) || vibration_rms < 0)
    throw new Error("vibration_rms must be a number >= 0");
  const rawTs = raw.timestamp || raw.ts;
  const ts = rawTs ? new Date(rawTs) : new Date();
  if (Number.isNaN(ts.getTime())) throw new Error("invalid timestamp");
  const opt = (v) => (v === undefined || v === null || v === "" ? null : Number(v));
  const frequency_hz = opt(raw.frequency_hz);
  const temperature_c = opt(raw.temperature_c);
  if ((frequency_hz !== null && !Number.isFinite(frequency_hz)) || (temperature_c !== null && !Number.isFinite(temperature_c)))
    throw new Error("frequency_hz / temperature_c must be numbers");
  return { sensor_id, ts, vibration_rms, frequency_hz, temperature_c };
}

/** Load a sensor's baseline (recent normal values) and open-alert times from MongoDB. */
async function loadState(sensorId) {
  const state = newState();
  const recent = await Reading.find({ sensor_id: sensorId, is_anomaly: false })
    .sort({ ts: -1 }).limit(BASELINE_N).select("vibration_rms frequency_hz").lean();
  for (const r of recent.reverse()) {
    state.vib.push(r.vibration_rms);
    if (r.frequency_hz != null) state.freq.push(r.frequency_hz);
  }
  const open = await Alert.aggregate([
    { $match: { sensor_id: sensorId, status: "open" } },
    { $group: { _id: "$type", last: { $max: "$ts" } } },
  ]);
  for (const o of open) state.lastAlertAt[o._id] = o.last.getTime();
  return state;
}

/** Process many readings (already normalised): analyse, store readings, create alerts. */
export async function ingest(readings) {
  const bySensor = new Map();
  for (const r of readings) {
    if (!bySensor.has(r.sensor_id)) bySensor.set(r.sensor_id, []);
    bySensor.get(r.sensor_id).push(r);
  }
  const docs = [], alerts = [];
  for (const [sensorId, list] of bySensor) {
    const state = await loadState(sensorId);
    list.sort((a, b) => a.ts - b.ts);
    for (const r of list) {
      const res = evaluate(r, state);
      docs.push({ ...r, z_score: res.z_score, is_anomaly: res.is_anomaly });
      alerts.push(...res.alerts);
    }
  }
  if (docs.length) await Reading.insertMany(docs, { ordered: false });
  if (alerts.length) await Alert.insertMany(alerts, { ordered: false });
  return {
    processed: docs.length,
    anomalies: docs.filter((d) => d.is_anomaly).length,
    alerts_created: alerts.length,
  };
}
