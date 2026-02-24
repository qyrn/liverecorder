import { statSync, existsSync, unlinkSync, readdirSync, renameSync } from "fs";
import { basename, dirname } from "path";
import { getDb } from "../db/client.js";
import { config } from "../config.js";
import { spawnProcess, killProcess } from "../utils/subprocess.js";
import { buildFilepath } from "../utils/filename.js";
import { getTwitchVODDirectUrl, extractVODId } from "../utils/twitch-vod-bypass.js";
import { downloadHLSParallel } from "../utils/parallel-hls-downloader.js";
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
    // Petit délai pour que Windows libère les handles de fichier après taskkill
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

function cleanResidualFiles(filePath) {
  try {
    const dir = dirname(filePath);
    const base = basename(filePath);
    for (const f of readdirSync(dir)) {
      if (f.startsWith(base + ".") || f.startsWith(base + "-")) {
        try { unlinkSync(`${dir}/${f}`); } catch {}
      }
    }
  } catch {}
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

async function handleDownloadClose(recordingId, exitCode, stderrBuf) {
  const entry = active.get(recordingId);
  if (!entry) return;

  clearInterval(entry.progressInterval);
  active.delete(recordingId);

  const { filePath, startedAtMs, cancelled } = entry;

  let actual = getActualFilePath(filePath);
  if (actual.endsWith(".part")) {
    if (!cancelled && exitCode === 0) {
      try { renameSync(actual, filePath); actual = filePath; } catch {}
    } else {
      const remuxed = await remuxPartFile(actual, filePath);
      if (remuxed) actual = filePath;
    }
  }

  cleanResidualFiles(filePath);

  const finalSize = getFileSize(actual);
  const duration = Math.floor((Date.now() - startedAtMs) / 1000);
  const status = cancelled ? "cancelled" : exitCode === 0 ? "completed" : "failed";

  if (status === "failed") {
    console.error(
      `[recorder] #${recordingId} failed (code ${exitCode}): ${stderrBuf.slice(-500) || "(aucune sortie d'erreur)"}`
    );
  }

  const db = getDb();
  db.prepare(
    `UPDATE recordings
     SET status = ?, file_size_bytes = ?, duration_sec = ?, ended_at = ?, file_path = ?
     WHERE id = ?`
  ).run(status, finalSize, duration, new Date().toISOString(), actual, recordingId);

  broadcastRecordingEnded(recordingId, { status, file_size_bytes: finalSize, duration_sec: duration });
}

function detectPlatform(url) {
  if (url.includes("twitch.tv")) return "twitch";
  if (url.includes("tiktok.com")) return "tiktok";
  return "youtube";
}

export async function startDownload({ url, qualityPreset: qpOverride } = {}) {
  if (active.size >= config.maxConcurrent) {
    throw new Error("max concurrent downloads reached");
  }

  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();

  const db = getDb();
  const platform = detectPlatform(url);

  const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('cookies_file', 'quality_preset')").all();
  const settingsMap = Object.fromEntries(settings.map((r) => [r.key, r.value]));
  const cookiesFile = settingsMap.cookies_file ?? "";
  const qualityPreset = qpOverride ?? settingsMap.quality_preset ?? "source";

  let effectiveUrl = url;
  let resolvedTitle = null;
  let resolvedStreamer = "unknown";
  let bypassUsed = false;

  if (platform === "twitch") {
    const vodId = extractVODId(url);
    if (vodId) {
      try {
        const bypass = await getTwitchVODDirectUrl(vodId, qualityPreset);
        effectiveUrl = bypass.url;
        if (bypass.title) resolvedTitle = bypass.title;
        if (bypass.channelLogin) resolvedStreamer = bypass.channelLogin;
        bypassUsed = true;
        console.log(
          `[bypass] VOD ${vodId} (${resolvedStreamer}) → ${bypass.url.split("/").slice(0, 5).join("/")}/... [${config.hlsConcurrency} workers]`
        );
      } catch (err) {
        console.warn(`[bypass] ${err.message} — fallback yt-dlp natif`);
      }
    }
  }

  const result = db.prepare(
    `INSERT INTO recordings (platform, stream_title, status, started_at)
     VALUES (?, ?, 'recording', ?)`
  ).run(platform, resolvedTitle, startedAtIso);

  const recordingId = result.lastInsertRowid;
  const filePath = buildFilepath({ platform, streamerName: resolvedStreamer, streamTitle: resolvedTitle, recordingId });

  db.prepare("UPDATE recordings SET file_path = ? WHERE id = ?").run(filePath, recordingId);

  const FORMAT_MAP = {
    "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "720p":  "bestvideo[height<=720]+bestaudio/best[height<=720]",
    "480p":  "bestvideo[height<=480]+bestaudio/best[height<=480]",
  };

  const entry = {
    platform,
    filePath,
    startedAtMs,
    progressInterval: null,
    proc: null,
    abortCtrl: null,
    cancelled: false,
  };

  active.set(recordingId, entry);

  entry.progressInterval = setInterval(() => {
    const progress = dbUpdateProgress(recordingId, startedAtMs, filePath);
    if (progress) {
      broadcastRecordingProgress(recordingId, progress);
    }
  }, 2000);

  if (bypassUsed) {
    const ac = new AbortController();
    entry.abortCtrl = ac;

    downloadHLSParallel(effectiveUrl, filePath, {
      concurrency: config.hlsConcurrency,
      signal: ac.signal,
      onProgress: ({ done, total, percent }) => {
        if (done % 50 === 0 || done === total) {
          console.log(`[hls] #${recordingId} ${percent}% (${done}/${total} segments)`);
        }
        broadcastRecordingProgress(recordingId, {
          file_size_bytes: getFileSize(getActualFilePath(filePath)),
          duration_sec: Math.floor((Date.now() - startedAtMs) / 1000),
          percent,
        });
      },
    })
      .then(() => handleDownloadClose(recordingId, 0, ""))
      .catch((err) => {
        if (err.cancelled) {
          handleDownloadClose(recordingId, 0, "");
        } else {
          handleDownloadClose(recordingId, 1, err.message ?? "");
        }
      });
  } else {
    const args = [
      "--no-colors",
      "--newline",
      "--merge-output-format", "mp4",
      "--ffmpeg-location", config.ffmpegPath,
      "-o", filePath,
      "--retries", "5",
      "--fragment-retries", "5",
      "--skip-unavailable-fragments",
      "--socket-timeout", "30",
      "--concurrent-fragments", String(config.ytdlpConcurrentFragments),
    ];

    if (FORMAT_MAP[qualityPreset]) {
      args.push("-f", FORMAT_MAP[qualityPreset]);
    }

    if (cookiesFile && existsSync(cookiesFile)) {
      args.push("--cookies", cookiesFile);
    }

    args.push(effectiveUrl);
    entry.proc = spawnProcess(config.ytdlpPath, args);

    let stderrBuf = "";
    entry.proc.stderr.on("data", (d) => { stderrBuf += d; });
    entry.proc.on("close", (code) => handleDownloadClose(recordingId, code, stderrBuf));
  }

  return recordingId;
}

export async function stopDownload(recordingId) {
  const entry = active.get(recordingId);
  if (!entry) return false;
  clearInterval(entry.progressInterval);
  entry.cancelled = true;

  if (entry.abortCtrl) {
    entry.abortCtrl.abort();
  } else if (entry.proc?.pid) {
    await killProcess(entry.proc.pid);
  }

  return true;
}

export async function stopAll() {
  await Promise.all(Array.from(active.keys()).map(stopDownload));
}
