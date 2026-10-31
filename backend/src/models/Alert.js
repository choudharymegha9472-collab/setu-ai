import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    sensor_id: { type: String, required: true, index: true },
    ts: { type: Date, required: true },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    value: { type: Number, default: null },
    z_score: { type: Number, default: null },
    status: { type: String, enum: ["open", "acknowledged", "resolved"], default: "open" },
  },
  { versionKey: false }
);
alertSchema.index({ status: 1, ts: -1 });

export const Alert = mongoose.model("Alert", alertSchema);
