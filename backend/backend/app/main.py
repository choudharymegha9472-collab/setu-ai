from __future__ import annotations

import csv
import io
import math
import random
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Setu AI API", version="0.1.0", description="Vibration analysis prototype")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this to the deployed frontend origin before production.
    allow_methods=["*"],
    allow_headers=["*"],
)


class Reading(BaseModel):
    timestamp: datetime
    value: float


class AnalyzeRequest(BaseModel):
    machine_id: str = "Machine-01"
    sensor: str = "vibration"
    readings: list[Reading] = Field(min_length=8, max_length=100_000)


def analyze(readings: list[Reading], machine_id: str, sensor: str) -> dict[str, Any]:
    values = [r.value for r in readings]
    if not all(math.isfinite(v) for v in values):
        raise HTTPException(422, "Readings must contain finite numeric values")
    window = max(4, min(20, len(values) // 8))
    features = []
    for i in range(0, len(values), window):
        chunk = values[i:i + window]
        if len(chunk) < max(3, window // 2):
            continue
        rms = math.sqrt(sum(v * v for v in chunk) / len(chunk))
        peak_to_peak = max(chunk) - min(chunk)
        peak = max(abs(v) for v in chunk)
        crest = peak / rms if rms else 0.0
        features.append({
            "timestamp": readings[i + len(chunk) - 1].timestamp.isoformat(),
            "rms": round(rms, 5), "peak_to_peak": round(peak_to_peak, 5),
            "crest_factor": round(crest, 3),
        })
    baseline = median(f["rms"] for f in features)
    deviations = [abs(f["rms"] - baseline) for f in features]
    mad = median(deviations) if deviations else 0
    threshold = baseline + max(3.5 * 1.4826 * mad, baseline * 0.45, 1e-9)
    alerts = []
    for feature in features:
        if feature["rms"] > threshold:
            ratio = feature["rms"] / max(baseline, 1e-9)
            severity = "critical" if ratio >= 2.2 else "warning"
            alerts.append({
                "id": f"{machine_id}-{len(alerts)+1}", "machine_id": machine_id,
                "sensor": sensor, "severity": severity, "status": "open",
                "timestamp": feature["timestamp"], "metric": "rolling RMS",
                "value": feature["rms"], "baseline": round(baseline, 5),
                "message": f"Vibration RMS is {ratio:.1f}× the observed baseline. Inspect mounting, imbalance, and bearing condition.",
            })
    return {
        "machine_id": machine_id, "sensor": sensor, "sample_count": len(values),
        "baseline_rms": round(baseline, 5), "threshold_rms": round(threshold, 5),
        "features": features, "alerts": alerts,
        "summary": {"normal_windows": len(features) - len(alerts), "alert_windows": len(alerts)},
    }


def demo_payload() -> AnalyzeRequest:
    rng = random.Random(23)
    start = datetime.now(timezone.utc) - timedelta(minutes=10)
    readings = []
    for i in range(600):
        # Simulated acceleration signal; the last 20% has increased vibration.
        amp = 0.13 if i < 480 else 0.48
        value = amp * math.sin(i * 0.38) + rng.gauss(0, amp * 0.24)
        readings.append(Reading(timestamp=start + timedelta(seconds=i), value=value))
    return AnalyzeRequest(machine_id="Pump-A12", sensor="bearing-housing-x", readings=readings)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Setu AI API"}


@app.get("/api/demo")
def demo():
    payload = demo_payload()
    return analyze(payload.readings, payload.machine_id, payload.sensor)


@app.post("/api/analyze")
def analyze_endpoint(payload: AnalyzeRequest):
    return analyze(payload.readings, payload.machine_id, payload.sensor)


@app.post("/api/upload")
async def upload(file: UploadFile = File(...), machine_id: str = "Machine-01"):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Upload a .csv file")
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "CSV must be smaller than 10 MB")
    try:
        reader = csv.DictReader(io.StringIO(raw.decode("utf-8-sig")))
        if not reader.fieldnames or "timestamp" not in [h.strip().lower() for h in reader.fieldnames]:
            raise ValueError("CSV requires a timestamp column")
        timestamp_header = next(h for h in reader.fieldnames if h.strip().lower() == "timestamp")
        sensor_header = next((h for h in reader.fieldnames if h != timestamp_header and h.strip()), None)
        if not sensor_header:
            raise ValueError("CSV requires a numeric sensor column")
        readings = []
        for row in reader:
            if not row.get(timestamp_header) or not row.get(sensor_header):
                continue
            stamp = datetime.fromisoformat(row[timestamp_header].strip().replace("Z", "+00:00"))
            readings.append(Reading(timestamp=stamp, value=float(row[sensor_header])))
        if len(readings) < 8:
            raise ValueError("At least 8 valid readings are required")
        return analyze(readings, machine_id, sensor_header)
    except (UnicodeDecodeError, ValueError, KeyError) as exc:
        raise HTTPException(422, f"Could not parse CSV: {exc}") from exc
