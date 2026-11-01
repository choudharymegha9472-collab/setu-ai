import { Router } from "express";
import { Reading } from "../models/Reading.js";
import { Alert } from "../models/Alert.js";
import { ingest, normalise } from "../services/ingest.js";
import { waveformFeatures } from "../services/analysis.js";
import { generate } from "../services/simulator.js";

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

router.get("/health", (_req, res) => res.json({ status: "ok", service: "setu-ai" }));

// ---------- ingest ----------
router.post("/readings", wrap(async (req, res) => {
  let r;
  try { r = normalise(req.body || {}); } catch (e) { throw bad(e.message); }
  res.status(201).json(await ingest([r]));
}));

router.post("/readings/batch", wrap(async (req, res) => {
  const list = req.body?.readings;
  if (!Array.isArray(list) || !list.length) throw bad("body must be { readings: [ ... ] }");
  if (list.length > 5000) throw bad("max 5000 readings per request");
  let rows;
  try { rows = list.map(normalise); } catch (e) { throw bad(e.message); }
  res.status(201).json(await ingest(rows));
}));

// CSV: sensor_id,timestamp,vibration_rms,frequency_hz,temperature_c  (sent as text/csv body)
router.post("/upload-csv", wrap(async (req, res) => {
  const text = typeof req.body === "string" ? req.body.replace(/^\uFEFF/, "") : "";
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw bad("CSV is empty");
  const head = lines[0].split(",").map((h) => h.trim());
  if (!head.includes("sensor_id") || !head.includes("vibration_rms"))
    throw bad("CSV must have columns: sensor_id, vibration_rms (timestamp, frequency_hz, temperature_c optional)");
  const rows = []; let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const obj = Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? "").trim()]));
    try { rows.push(normalise(obj)); } catch { skipped++; }
  }
  if (!rows.length) throw bad("No valid rows found in CSV");
  if (rows.length > 20000) throw bad("max 20000 rows per upload");
  res.status(201).json({ ...(await ingest(rows)), skipped_bad_rows: skipped });
}));

router.post("/analyze-waveform", wrap(async (req, res) => {
  try { res.json(waveformFeatures(req.body?.samples, Number(req.body?.sample_rate_hz))); }
  catch (e) { throw bad(e.message); }
}));

// ---------- read ----------
router.get("/sensors", wrap(async (_req, res) => {
  const [stats, open] = await Promise.all([
    Reading.aggregate([{ $group: {
      _id: "$sensor_id", readings: { $sum: 1 }, last_seen: { $max: "$ts" },
      avg_vibration: { $avg: "$vibration_rms" }, anomalies: { $sum: { $cond: ["$is_anomaly", 1, 0] } },
    } }, { $sort: { _id: 1 } }]),
    Alert.aggregate([{ $match: { status: "open" } }, { $group: { _id: "$sensor_id", n: { $sum: 1 } } }]),
  ]);
  const openMap = new Map(open.map((o) => [o._id, o.n]));
  res.json(stats.map((s) => ({
    sensor_id: s._id, readings: s.readings, last_seen: s.last_seen,
    avg_vibration: Math.round(s.avg_vibration * 1000) / 1000,
    anomalies: s.anomalies, open_alerts: openMap.get(s._id) || 0,
  })));
}));

router.get("/readings/:sensorId", wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 300, 1), 5000);
  const rows = await Reading.find({ sensor_id: req.params.sensorId }).sort({ ts: -1 }).limit(limit).lean();
  res.json(rows.reverse());
}));

router.get("/alerts", wrap(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = String(req.query.status);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 1000);
  res.json(await Alert.find(filter).sort({ ts: -1 }).limit(limit).lean());
}));

router.patch("/alerts/:id", wrap(async (req, res) => {
  const { status } = req.body || {};
  if (!["open", "acknowledged", "resolved"].includes(status)) throw bad("status must be open | acknowledged | resolved");
  const a = await Alert.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
  if (!a) throw Object.assign(new Error("Alert not found"), { status: 404 });
  res.json(a);
}));

router.get("/summary", wrap(async (_req, res) => {
  const [sensors, readings, open_alerts, critical_open] = await Promise.all([
    Reading.distinct("sensor_id").then((x) => x.length),
    Reading.estimatedDocumentCount(),
    Alert.countDocuments({ status: "open" }),
    Alert.countDocuments({ status: "open", severity: "critical" }),
  ]);
  res.json({ sensors, readings, open_alerts, critical_open });
}));

// ---------- demo ----------
router.post("/simulate", wrap(async (req, res) => {
  const sensors = Math.min(Math.max(parseInt(req.query.sensors) || 3, 1), 10);
  const points = Math.min(Math.max(parseInt(req.query.points) || 300, 50), 2000);
  res.status(201).json(await ingest(generate(sensors, points)));
}));

router.delete("/reset", wrap(async (_req, res) => {
  await Promise.all([Reading.deleteMany({}), Alert.deleteMany({})]);
  res.json({ status: "cleared" });
}));

export default router;
