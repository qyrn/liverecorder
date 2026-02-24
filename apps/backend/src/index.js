import { createServer } from "http";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { runMigrations } from "./db/migrations.js";
import { getDb } from "./db/client.js";
import { stopAll } from "./services/recorder.js";
import { setBroadcasterWss, sendInit } from "./services/broadcaster.js";
import healthRouter from "./routes/health.js";
import recordingsRouter from "./routes/recordings.js";
import settingsRouter from "./routes/settings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const portFilePath = resolve(__dirname, "../../../.port");

function checkPrerequisites() {
  const db = getDb();
  const rows = db.prepare(
    "SELECT key, value FROM settings WHERE key IN ('ytdlp_path', 'ffmpeg_path')"
  ).all();
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const ytdlpPath  = m.ytdlp_path  || "C:/yt-dlp/yt-dlp.exe";
  const ffmpegPath = m.ffmpeg_path || "C:/ffmpeg/bin/ffmpeg.exe";

  const missing = [];
  if (!existsSync(ytdlpPath))  missing.push(`yt-dlp not found at ${ytdlpPath}`);
  if (!existsSync(ffmpegPath)) missing.push(`ffmpeg not found at ${ffmpegPath}`);
  if (missing.length) {
    console.warn("[startup] Missing tools:");
    for (const m of missing) console.warn(`  - ${m}`);
    console.warn("[startup] Configure tool paths in Settings.");
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

function listen(port) {
  httpServer.listen(port, () => {
    writeFileSync(portFilePath, String(port));
    console.log(`LiveRecorder running on http://localhost:${port}`);
  });
  httpServer.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${port} occupé, essai du port ${port + 1}...`);
      listen(port + 1);
    } else {
      throw err;
    }
  });
}

listen(config.port);

process.on("SIGINT", async () => {
  console.log("Shutting down — stopping active downloads...");
  await stopAll();
  if (existsSync(portFilePath)) unlinkSync(portFilePath);
  httpServer.close(() => process.exit(0));
});
