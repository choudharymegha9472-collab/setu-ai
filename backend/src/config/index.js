import dotenv from "dotenv";
dotenv.config();

const num = (v, d) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 5000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/setu_ai",
  clientOrigin: (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim()),
  thresholds: {
    warn: num(process.env.VIB_WARN, 4.5),
    high: num(process.env.VIB_HIGH, 7.1),
    critical: num(process.env.VIB_CRITICAL, 11.2),
    tempLimit: num(process.env.TEMP_LIMIT, 85),
  },
};
