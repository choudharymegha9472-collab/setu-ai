import mongoose from "mongoose";

const readingSchema = new mongoose.Schema(
  {
    sensor_id: { type: String, required: true, trim: true, index: true },
    ts: { type: Date, required: true },
    vibration_rms: { type: Number, required: true, min: 0 }, // mm/s RMS
    frequency_hz: { type: Number, default: null },
    temperature_c: { type: Number, default: null },
    z_score: { type: Number, default: null },
    is_anomaly: { type: Boolean, default: false },
  },
  { versionKey: false }
);
readingSchema.index({ sensor_id: 1, ts: -1 });

export const Reading = mongoose.model("Reading", readingSchema);
