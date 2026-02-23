import { statSync, existsSync, unlinkSync } from "fs";
import { getDb } from "../db/client.js";
import { config } from "../config.js";
import { spawnProcess, killProcess } from "../utils/subprocess.js";
import { buildFilepath } from "../utils/filename.js";
import {
  broadcastRecordingProgress,
  broadcastRecordingEnded,
} from "./broadcaster.js";

const active = new Map();

function getFileSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function getActualFilePath(basePath) {
  if (existsSync(basePath)) return basePath;
  const webm = basePath.replace(/\.mp4$/, ".mp4.webm");
  if (existsSync(webm)) return webm;
  const part = basePath + ".part";
  if (existsSync(part)) return part;
  return basePath;
}

async function remuxPartFile(partPath, outputPath) {
  return new Promise((resolve) => {
    // Small delay to ensure Windows has released file handles after taskkill
    setTimeout(() => {
      const proc = spawnProcess(config.ffmpegPath, [
        "-i", partPath,
        "-c", "copy",
        "-y",
        outputPath,
      ]);
      let errBuf = "";
      proc.stderr.on("data", (d) => { errBuf += d; });
      proc.on("close", (code) => {
        if (code === 0) {
          try { unlinkSync(partPath); } catch {}
          resolve(true);
        } else {
          console.error("[remux] ffmpeg failed (code %d): %s", code, errBuf.slice(-400));
          resolve(false);
        }
      });
    }, 1000);
  });
}

function dbUpdateProgress(recordingId, startedAtMs, filePath) {
  const db = getDb();
  const actual = getActualFilePath(filePath);
  const size = getFileSize(actual);
  const duration = Math.floor((Date.now() - startedAtMs) / 1000);
  db.prepare(
    "UPDATE recordings SET file_size_bytes = ?, duration_sec = ? WHERE id = ?"
  ).run(size, duration, recordingId);
  return { file_size_bytes: size, duration_sec: duration };
}

export function isRecording(streamerId) {
  for (const entry of active.values()) {
    if (entry.streamerId === streamerId) return true;
  }
  return false;
}

export async function startRecording({ streamerId, platform, streamUrl, streamTitle, trigger = "auto", streamerName }) {
  if (active.size >= config.maxConcurrent) {
    throw new Error("max concurrent recordings reached");
  }

  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();

  const db = getDb();
  const result = db.prepare(
    `INSERT INTO recordings (streamer_id, platform, stream_title, status, trigger, started_at)
     VALUES (?, ?, ?, 'recording', ?, ?)`
  ).run(streamerId ?? null, platform, streamTitle ?? null, trigger, startedAtIso);

  const recordingId = result.lastInsertRowid;
  const filePath = buildFilepath({ platform, streamerName: streamerName ?? "unknown", recordingId });

  db.prepare("UPDATE recordings SET file_path = ? WHERE id = ?").run(filePath, recordingId);

  const isLive = (platform === "twitch" && !streamUrl.includes("/videos/")) || streamUrl.includes("/live");

  const args = [
    "--no-colors",
    "--newline",
    "--merge-output-format", "mp4",
    "--ffmpeg-location", config.ffmpegPath,
    "-o", filePath,
  ];

  if (isLive) {
    args.push("--live-from-start");
  }

  args.push(streamUrl);

  const proc = spawnProcess(config.ytdlpPath, args);

  const entry = {
    proc,
    streamerId,
    platform,
    filePath,
    startedAtMs,
    progressInterval: null,
    onEnd: null,
    onProgress: null,
  };

  active.set(recordingId, entry);

  entry.progressInterval = setInterval(() => {
    const progress = dbUpdateProgress(recordingId, startedAtMs, filePath);
    if (progress) {
      broadcastRecordingProgress(recordingId, progress);
      if (entry.onProgress) entry.onProgress(recordingId, progress);
    }
  }, 2000);

  proc.stderr.on("data", () => {});

  proc.on("close", async (code) => {
    clearInterval(entry.progressInterval);
    active.delete(recordingId);

    let actual = getActualFilePath(filePath);
    if (actual.endsWith(".part")) {
      const remuxed = await remuxPartFile(actual, filePath);
      if (remuxed) actual = filePath;
    }

    const finalSize = getFileSize(actual);
    const duration = Math.floor((Date.now() - startedAtMs) / 1000);
    const status = entry.cancelled ? "cancelled" : code === 0 ? "completed" : "failed";

    db.prepare(
      `UPDATE recordings
       SET status = ?, file_size_bytes = ?, duration_sec = ?, ended_at = ?, file_path = ?
       WHERE id = ?`
    ).run(status, finalSize, duration, new Date().toISOString(), actual, recordingId);

    broadcastRecordingEnded(recordingId, { status, file_size_bytes: finalSize, duration_sec: duration });
    if (entry.onEnd) entry.onEnd(recordingId, { status, file_size_bytes: finalSize, duration_sec: duration });
  });

  return recordingId;
}

export async function stopRecording(recordingId) {
  const entry = active.get(recordingId);
  if (!entry) return false;
  clearInterval(entry.progressInterval);
  entry.cancelled = true;
  if (entry.proc.pid) await killProcess(entry.proc.pid);
  return true;
}

export function onRecordingProgress(recordingId, cb) {
  const entry = active.get(recordingId);
  if (entry) entry.onProgress = cb;
}

export function onRecordingEnd(recordingId, cb) {
  const entry = active.get(recordingId);
  if (entry) entry.onEnd = cb;
}

export async function stopAll() {
  await Promise.all(Array.from(active.keys()).map(stopRecording));
}
