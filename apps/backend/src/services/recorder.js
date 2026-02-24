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

// Nombre de workers parallèles pour les VODs HLS (bypass CloudFront).
// 8 = bon équilibre vitesse/stabilité. Monter à 12-16 sur bonne connexion.
const HLS_CONCURRENCY = parseInt(process.env.HLS_CONCURRENCY || "8", 10);

// Fragments concurrents pour yt-dlp (VODs non-bypass).
const YTDLP_CONCURRENT_FRAGMENTS = parseInt(process.env.YTDLP_CONCURRENT_FRAGMENTS || "4", 10);

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

/**
 * Finalise un enregistrement dans la DB et notifie les clients.
 * Commun aux deux modes : process (yt-dlp/ffmpeg) et downloader HLS parallèle.
 */
async function handleRecordingClose(recordingId, exitCode, stderrBuf) {
  const entry = active.get(recordingId);
  if (!entry) return;

  clearInterval(entry.progressInterval);
  active.delete(recordingId);

  const { filePath, startedAtMs, cancelled } = entry;

  let actual = getActualFilePath(filePath);
  if (actual.endsWith(".part")) {
    if (!cancelled && exitCode === 0) {
      // ffmpeg terminé proprement : renommer .part → .mp4
      try { renameSync(actual, filePath); actual = filePath; } catch {}
    } else {
      // Interrompu ou échoué : tenter un remux
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
  if (entry.onEnd) entry.onEnd(recordingId, { status, file_size_bytes: finalSize, duration_sec: duration });
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

  const isLive = (platform === "twitch" && !streamUrl.includes("/videos/")) || streamUrl.includes("/live");

  const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('cookies_file', 'quality_preset')").all();
  const settingsMap = Object.fromEntries(settings.map((r) => [r.key, r.value]));
  const cookiesFile = settingsMap.cookies_file ?? "";
  const qualityPreset = settingsMap.quality_preset ?? "source";

  let effectiveUrl = streamUrl;
  let resolvedTitle = streamTitle ?? null;
  let resolvedStreamer = streamerName ?? "unknown";
  let bypassUsed = false;

  if (!isLive && platform === "twitch") {
    const vodId = extractVODId(streamUrl);
    if (vodId) {
      try {
        const bypass = await getTwitchVODDirectUrl(vodId, qualityPreset);
        effectiveUrl = bypass.url;
        if (!resolvedTitle && bypass.title) resolvedTitle = bypass.title;
        if (resolvedStreamer === "unknown" && bypass.channelLogin) resolvedStreamer = bypass.channelLogin;
        bypassUsed = true;
        console.log(
          `[bypass] VOD ${vodId} (${resolvedStreamer}) → ${bypass.url.split("/").slice(0, 5).join("/")}/... [${HLS_CONCURRENCY} workers]`
        );
      } catch (err) {
        console.warn(`[bypass] ${err.message} — fallback yt-dlp natif`);
      }
    }
  }

  const result = db.prepare(
    `INSERT INTO recordings (streamer_id, platform, stream_title, status, trigger, started_at)
     VALUES (?, ?, ?, 'recording', ?, ?)`
  ).run(streamerId ?? null, platform, resolvedTitle, trigger, startedAtIso);

  const recordingId = result.lastInsertRowid;
  const filePath = buildFilepath({ platform, streamerName: resolvedStreamer, streamTitle: resolvedTitle, recordingId });

  db.prepare("UPDATE recordings SET file_path = ? WHERE id = ?").run(filePath, recordingId);

  const FORMAT_MAP = {
    "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "720p":  "bestvideo[height<=720]+bestaudio/best[height<=720]",
    "480p":  "bestvideo[height<=480]+bestaudio/best[height<=480]",
  };

  const entry = {
    streamerId,
    platform,
    filePath,
    startedAtMs,
    progressInterval: null,
    onEnd: null,
    onProgress: null,
    proc: null,
    abortCtrl: null,  // AbortController pour le downloader HLS parallèle
    cancelled: false,
  };

  active.set(recordingId, entry);

  entry.progressInterval = setInterval(() => {
    const progress = dbUpdateProgress(recordingId, startedAtMs, filePath);
    if (progress) {
      broadcastRecordingProgress(recordingId, progress);
      if (entry.onProgress) entry.onProgress(recordingId, progress);
    }
  }, 2000);

  if (bypassUsed) {
    // Téléchargeur HLS parallèle : segments TS téléchargés concurremment puis fusionnés.
    // Évite les stalls de ffmpeg/yt-dlp en mode séquentiel sur CloudFront Twitch.
    const ac = new AbortController();
    entry.abortCtrl = ac;

    downloadHLSParallel(effectiveUrl, filePath, {
      concurrency: HLS_CONCURRENCY,
      signal: ac.signal,
      onProgress: ({ done, total, percent }) => {
        if (done % 50 === 0 || done === total) {
          console.log(`[hls] #${recordingId} ${percent}% (${done}/${total} segments)`);
        }
      },
    })
      .then(() => handleRecordingClose(recordingId, 0, ""))
      .catch((err) => {
        if (err.cancelled) {
          handleRecordingClose(recordingId, 0, "");
        } else {
          handleRecordingClose(recordingId, 1, err.message ?? "");
        }
      });
  } else {
    // yt-dlp : --concurrent-fragments pour paralléliser le téléchargement des fragments HLS.
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
      "--concurrent-fragments", String(YTDLP_CONCURRENT_FRAGMENTS),
    ];

    if (FORMAT_MAP[qualityPreset]) {
      args.push("-f", FORMAT_MAP[qualityPreset]);
    }

    if (cookiesFile && existsSync(cookiesFile)) {
      args.push("--cookies", cookiesFile);
    }

    if (isLive) {
      args.push("--live-from-start");
    }

    args.push(effectiveUrl);
    entry.proc = spawnProcess(config.ytdlpPath, args);

    let stderrBuf = "";
    entry.proc.stderr.on("data", (d) => { stderrBuf += d; });
    entry.proc.on("close", (code) => handleRecordingClose(recordingId, code, stderrBuf));
  }

  return recordingId;
}

export async function stopRecording(recordingId) {
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
