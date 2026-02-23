import { createServer } from "http";
import { WebSocketServer } from "ws";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { runMigrations } from "./db/migrations.js";
import { stopAll } from "./services/recorder.js";
import { startMonitor, stopMonitor } from "./services/monitor.js";
import { setBroadcasterWss, sendInit, broadcastRecordingStarted } from "./services/broadcaster.js";
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

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

setBroadcasterWss(wss);

wss.on("connection", (ws) => {
  sendInit(ws);
  ws.on("error", () => {});
});

httpServer.listen(config.port, () => {
  console.log(`Backend running on http://localhost:${config.port}`);
  startMonitor({
    onStarted: (recordingId, meta) => broadcastRecordingStarted(recordingId, meta),
  });
});

process.on("SIGINT", async () => {
  console.log("Shutting down — stopping active recordings...");
  stopMonitor();
  await stopAll();
  httpServer.close(() => process.exit(0));
});
