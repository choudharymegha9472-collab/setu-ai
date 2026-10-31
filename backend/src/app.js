import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import routes from "./routes/index.js";

const app = express();
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "5mb" }));
app.use(express.text({ type: ["text/csv", "text/plain"], limit: "10mb" }));

app.use("/api", routes);

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.name === "CastError") return res.status(400).json({ error: "Invalid id" });
  const status = err.status || (err.type === "entity.parse.failed" ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? "Internal server error" : err.message });
});

export default app;
