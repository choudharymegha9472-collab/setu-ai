import app from "./app.js";
import { config } from "./config/index.js";
import { connectDB } from "./config/db.js";

try {
  await connectDB();
  app.listen(config.port, () => console.log(`Setu AI API running on http://localhost:${config.port}`));
} catch (err) {
  console.error("Could not start server:", err.message);
  console.error("Is MongoDB running? Check MONGO_URI in backend/.env");
  process.exit(1);
}
