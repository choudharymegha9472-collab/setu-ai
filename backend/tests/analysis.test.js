import test from "node:test";
import assert from "node:assert/strict";
import { robustZ, waveformFeatures } from "../src/services/analysis.js";
import { evaluate, newState } from "../src/services/alertEngine.js";
import { generate } from "../src/services/simulator.js";

const T = { warn: 4.5, high: 7.1, critical: 11.2, tempLimit: 85 };
const mk = (v, i, sid = "S1", extra = {}) => ({ sensor_id: sid, ts: new Date(Date.UTC(2026, 0, 1, 0, i)), vibration_rms: v, ...extra });

test("waveform dominant frequency ~50 Hz", () => {
  const fs = 1000;
  const x = Array.from({ length: 1000 }, (_, i) => Math.sin((2 * Math.PI * 50 * i) / fs));
  const f = waveformFeatures(x, fs);
  assert.ok(Math.abs(f.dominant_freq_hz - 50) < 2, `got ${f.dominant_freq_hz}`);
});

test("robustZ needs a baseline", () => assert.equal(robustZ(5, [1, 2, 3]), null));

test("normal data raises no alerts", () => {
  const st = newState();
  let n = 0;
  for (let i = 0; i < 80; i++) n += evaluate(mk(2 + (i % 5) * 0.03, i), st, T).alerts.length;
  assert.equal(n, 0);
});

test("a spike after normal data raises an alert", () => {
  const st = newState();
  for (let i = 0; i < 60; i++) evaluate(mk(2 + (i % 3) * 0.05, i), st, T);
  const res = evaluate(mk(9, 61), st, T);
  assert.ok(res.is_anomaly);
  assert.ok(res.alerts.length >= 1);
});

test("duplicate alerts within 10 minutes are suppressed", () => {
  const st = newState();
  for (let i = 0; i < 60; i++) evaluate(mk(2, i), st, T);
  const a = evaluate(mk(9, 61), st, T).alerts.length;
  const b = evaluate(mk(9.5, 62), st, T).alerts.length;
  assert.ok(a >= 1);
  assert.equal(b, 0);
});

test("high temperature alert", () => {
  const st = newState();
  const res = evaluate(mk(2, 0, "S1", { temperature_c: 99 }), st, T);
  assert.ok(res.alerts.some((a) => a.type === "high_temperature"));
});

test("simulation flags the faulty sensor", () => {
  const data = generate(3, 300).sort((a, b) => a.ts - b.ts);
  const states = {};
  const counts = {};
  for (const r of data) {
    const st = (states[r.sensor_id] ??= newState());
    counts[r.sensor_id] = (counts[r.sensor_id] || 0) + evaluate(r, st, T).alerts.length;
  }
  assert.ok(counts["PUMP-01"] > 0);
});
