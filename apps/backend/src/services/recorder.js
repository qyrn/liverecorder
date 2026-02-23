import { statSync } from "fs";
import { getDb } from "../db/client.js";
import { config } from "../config.js";
import { spawnProcess, killProcess } from "../utils/subprocess.js";
import { buildFilepath } from "../utils/filename.js";

const active = new Map();

function getFileSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function dbUpdateProgress(recordingId, filePath) {
  const db = getDb();
  const size = getFileSize(filePath);
  const row = db.prepare("SELECT started_at FROM recordings WHERE id = ?").get(recordingId);
  if (!row) return;
  const duration = Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000);
  db.prepare(
    "UPDATE recordings SET file_size_bytes = ?, duration_sec = ? WHERE id = ?"
  ).run(size, duration, recordingId);
  return { file_size_bytes: size, duration_sec: duration };
}

export function getActiveRecordings() {
  return Array.from(active.entries()).map(([id, entry]) => ({
    recordingId: id,
    streamerId: entry.streamerId,
    platform: entry.platform,
    filePath: entry.filePath,
    startedAt: entry.startedAt,
  }));
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

  const db = getDb();
  const result = db.prepare(
    `INSERT INTO recordings (streamer_id, platform, stream_title, status, trigger, started_at)
     VALUES (?, ?, ?, 'recording', ?, datetime('now'))`
  ).run(streamerId ?? null, platform, streamTitle ?? null, trigger);

  const recordingId = result.lastInsertRowid;
  const filePath = buildFilepath({ platform, streamerName: streamerName ?? "unknown", recordingId });

  db.prepare("UPDATE recordings SET file_path = ? WHERE id = ?").run(filePath, recordingId);

  const args = [
    "--no-colors",
    "--newline",
    "--ffmpeg-location", config.ffmpegPath,
    "-o", filePath,
    streamUrl,
    "best",
  ];

  const proc = spawnProcess(config.ytdlpPath, args);

  const entry = {
    proc,
    streamerId,
    platform,
    filePath,
    startedAt: new Date().toISOString(),
    progressInterval: null,
    onEnd: null,
  };

  active.set(recordingId, entry);

  entry.progressInterval = setInterval(() => {
    const progress = dbUpdateProgress(recordingId, filePath);
    if (entry.onProgress && progress) {
      entry.onProgress(recordingId, progress);
    }
  }, 2000);

  proc.on("close", (code) => {
    clearInterval(entry.progressInterval);
    active.delete(recordingId);

    const finalSize = getFileSize(filePath);
    const rec = db.prepare("SELECT started_at FROM recordings WHERE id = ?").get(recordingId);
    const duration = rec
      ? Math.floor((Date.now() - new Date(rec.started_at).getTime()) / 1000)
      : 0;

    const status = code === 0 ? "completed" : code === null ? "cancelled" : "failed";

    db.prepare(
      `UPDATE recordings
       SET status = ?, file_size_bytes = ?, duration_sec = ?, ended_at = datetime('now')
       WHERE id = ?`
    ).run(status, finalSize, duration, recordingId);

    if (entry.onEnd) {
      entry.onEnd(recordingId, { status, file_size_bytes: finalSize, duration_sec: duration });
    }
  });

  return recordingId;
}

export async function stopRecording(recordingId) {
  const entry = active.get(recordingId);
  if (!entry) return false;

  clearInterval(entry.progressInterval);

  if (entry.proc.pid) {
    await killProcess(entry.proc.pid);
  }

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
  const ids = Array.from(active.keys());
  await Promise.all(ids.map(stopRecording));
}
