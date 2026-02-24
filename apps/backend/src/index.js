import { createServer } from "http";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { runMigrations } from "./db/migrations.js";
import { stopAll } from "./services/recorder.js";
import { setBroadcasterWss, sendInit } from "./services/broadcaster.js";
import healthRouter from "./routes/health.js";
import recordingsRouter from "./routes/recordings.js";
import settingsRouter from "./routes/settings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function checkPrerequisites() {
  const missing = [];
  if (!existsSync(config.ytdlpPath)) missing.push(`yt-dlp not found at ${config.ytdlpPath}`);
  if (!existsSync(config.ffmpegPath)) missing.push(`ffmpeg not found at ${config.ffmpegPath}`);
  if (missing.length) {
    console.warn("[startup] Missing tools:");
    for (const m of missing) console.warn(`  - ${m}`);
    console.warn("[startup] Recording will not work until these are installed.");
  }
}

runMigrations();
checkPrerequisites();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/recordings", recordingsRouter);
app.use("/api/settings", settingsRouter);

const frontendDist = resolve(__dirname, "../../../frontend/dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(resolve(frontendDist, "index.html"));
    }
  });
}

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
  console.log(`LiveRecorder running on http://localhost:${config.port}`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down — stopping active downloads...");
  await stopAll();
  httpServer.close(() => process.exit(0));
});
