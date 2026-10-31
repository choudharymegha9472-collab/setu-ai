# Setu AI – Roadmap

Goal: analyse sensor data → identify unusual vibration patterns → generate maintenance-inspection alerts.

## Phase 0 – Foundation (this zip = done)
- Backend API (Express + MongoDB (Mongoose)), frontend dashboard (React + Vite)
- Ingest readings (API, CSV upload, demo simulator)
- Rule + statistics based anomaly detection (robust z-score vs each sensor's own baseline, absolute vibration bands, frequency shift, temperature limit)
- Alerts with severity and status (open / acknowledged / resolved)
- Waveform analysis endpoint (RMS, peak, crest factor, kurtosis, dominant frequency via FFT)

## Phase 1 – Real data (Week 1–2)
- Decide data source: CSV exports, MQTT/IoT gateway, or direct accelerometer (e.g. ADXL345/MPU6050 + ESP32)
- Map your real columns/units to the CSV format; calibrate thresholds (`VIB_WARN/HIGH/CRITICAL in backend/.env`) per machine
- Collect 1–2 weeks of *healthy* data per machine to build the baseline

## Phase 2 – Better detection (Week 3–5)
- Frequency-band features (1x, 2x RPM, bearing defect frequencies BPFO/BPFI) from raw waveforms
- Add ML: Isolation Forest / One-Class SVM on feature vectors; later autoencoder / LSTM for trends
- Trend & remaining-useful-life estimate (slow drift detection, not only spikes)
- Reduce false alarms: alert dedup/cool-down (basic version already included), per-machine tuning

## Phase 3 – Alerts & workflow (Week 5–7)
- Notifications: email / WhatsApp / Telegram / SMS on high & critical alerts
- Inspection tickets: assign to technician, add notes, close with outcome (feeds back as labelled data)
- Shift/maintenance calendar, alert escalation if not acknowledged

## Phase 4 – Production (Week 8+)
- Login + roles (JWT auth) (admin, engineer, technician)
- MongoDB time-series collections + indexes, real-time updates via Socket.IO (WebSocket)
- Docker, deployment (on-premise server or cloud), monitoring and backups
- Multi-site / multi-machine hierarchy, PDF reports

## Suggested next steps
1. Run the project, load demo data, explore the dashboard.
2. Replace demo data with a CSV from your real sensors.
3. Tune thresholds, then pick Phase 2 or 3 depending on what matters most.
