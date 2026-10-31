import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import SummaryCards from "./components/SummaryCards.jsx";
import VibrationChart from "./components/VibrationChart.jsx";
import AlertsTable from "./components/AlertsTable.jsx";

export default function App() {
  const [summary, setSummary] = useState({});
  const [sensors, setSensors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [s, sens, al] = await Promise.all([api.summary(), api.sensors(), api.alerts()]);
      setSummary(s);
      setSensors(sens);
      setAlerts(al);
      setSelected((cur) => cur ?? sens[0]?.sensor_id ?? null);
    } catch (e) {
      setMsg(`Cannot reach backend: ${e.message}. Is it running on port 5000 (and MongoDB started)?`);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000); // auto-refresh every 10s
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!selected) { setReadings([]); return; }
    api.readings(selected).then(setReadings).catch((e) => setMsg(e.message));
  }, [selected, summary.readings]);

  const run = async (fn, okText) => {
    setBusy(true); setMsg("");
    try {
      const r = await fn();
      setMsg(okText(r));
      await refresh();
    } catch (e) { setMsg(`Error: ${e.message}`); }
    setBusy(false);
  };

  const changeStatus = async (id, status) => {
    try { await api.setAlertStatus(id, status); await refresh(); }
    catch (e) { setMsg(e.message); }
  };

  return (
    <div className="app">
      <header>
        <h1>Setu AI</h1>
        <p className="muted">Sensor data analysis · unusual vibration detection · maintenance alerts</p>
        <div className="toolbar">
          <button disabled={busy} onClick={() => run(api.simulate, (r) => `Demo loaded: ${r.processed} readings, ${r.alerts_created} alerts`)}>Load demo data</button>
          <button disabled={busy} onClick={() => fileRef.current?.click()}>Upload CSV</button>
          <input ref={fileRef} type="file" accept=".csv" hidden
            onChange={(e) => { const f = e.target.files[0]; if (f) run(() => api.uploadCsv(f), (r) => `CSV: ${r.processed} readings, ${r.alerts_created} alerts`); e.target.value = ""; }} />
          <button className="danger" disabled={busy} onClick={() => window.confirm("Delete all data?") && run(api.reset, () => "All data cleared")}>Reset</button>
        </div>
        {msg && <div className="msg">{msg}</div>}
      </header>

      <SummaryCards summary={summary} />

      <section>
        <div className="row">
          <h2>Vibration trend</h2>
          <select value={selected ?? ""} onChange={(e) => setSelected(e.target.value)}>
            {sensors.map((s) => (
              <option key={s.sensor_id} value={s.sensor_id}>
                {s.sensor_id} ({s.open_alerts} open alerts)
              </option>
            ))}
          </select>
        </div>
        {readings.length ? <VibrationChart data={readings} /> : <p className="muted">No data yet.</p>}
      </section>

      <section>
        <h2>Maintenance alerts</h2>
        <AlertsTable alerts={alerts} onStatus={changeStatus} />
      </section>
    </div>
  );
}
