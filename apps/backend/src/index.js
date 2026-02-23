import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { runMigrations } from "./db/migrations.js";
import { stopAll } from "./services/recorder.js";
import { startMonitor, stopMonitor } from "./services/monitor.js";
import healthRouter from "./routes/health.js";
import streamersRouter from "./routes/streamers.js";
import recordingsRouter from "./routes/recordings.js";
import settingsRouter from "./routes/settings.js";

runMigrations();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/streamers", streamersRouter);
app.use("/api/recordings", recordingsRouter);
app.use("/api/settings", settingsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const server = app.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`);
  startMonitor();
});

process.on("SIGINT", async () => {
  console.log("Shutting down — stopping active recordings...");
  stopMonitor();
  await stopAll();
  server.close(() => process.exit(0));
});
