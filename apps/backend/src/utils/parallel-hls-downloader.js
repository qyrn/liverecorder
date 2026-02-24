// Téléchargeur HLS parallèle — segments TS téléchargés concurremment puis concaténés via ffmpeg.
// Beaucoup plus rapide que ffmpeg séquentiel sur un m3u8 distant (8 workers = ~8x plus vite).

import { writeFile, mkdir, readdir, rm } from "fs/promises";
import { join } from "path";
import { spawnProcess } from "./subprocess.js";
import { config } from "../config.js";

const MAX_RETRIES = 5;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, signal, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt++) {
    if (signal?.aborted) {
      throw Object.assign(new Error("Download aborted"), { cancelled: true });
    }
    try {
      const resp = await fetch(url, {
        signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TwitchRecorder)" },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp;
    } catch (err) {
      if (err.cancelled || err.name === "AbortError") {
        throw Object.assign(new Error("Download aborted"), { cancelled: true });
      }
      if (attempt === retries - 1) throw err;
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
}

async function parseM3U8(playlistUrl, signal) {
  const resp = await fetchWithRetry(playlistUrl, signal);
  const text = await resp.text();
  const base = playlistUrl.substring(0, playlistUrl.lastIndexOf("/") + 1);

  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => (l.startsWith("http") ? l : base + l));
}

async function downloadSegment(url, filePath, signal) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw Object.assign(new Error("Download aborted"), { cancelled: true });
    }
    try {
      const resp = await fetchWithRetry(url, signal);
      const buffer = await resp.arrayBuffer();
      await writeFile(filePath, Buffer.from(buffer));
      return true;
    } catch (err) {
      if (err.cancelled || err.name === "AbortError") throw err;
      if (attempt === MAX_RETRIES - 1) {
        console.error(`[hls] Segment abandonné après ${MAX_RETRIES} tentatives: ${url}`);
        return false;
      }
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
  return false;
}

/**
 * Télécharge un flux HLS (m3u8) en parallèle et produit un fichier MP4 final.
 *
 * @param {string}   playlistUrl  URL du m3u8
 * @param {string}   outputPath   Chemin du fichier de sortie final (.mp4)
 * @param {object}   options
 * @param {number}   options.concurrency  Nombre de workers parallèles (défaut 8)
 * @param {AbortSignal} options.signal   Signal d'annulation
 * @param {Function} options.onProgress  Callback({ done, total, failed, percent })
 * @returns {Promise<{ total: number, downloaded: number, failed: number }>}
 */
export async function downloadHLSParallel(playlistUrl, outputPath, {
  concurrency = 8,
  signal = null,
  onProgress = null,
} = {}) {
  const tmpDir = outputPath + ".hlstmp";
  await mkdir(tmpDir, { recursive: true });

  try {
    const segments = await parseM3U8(playlistUrl, signal);
    const total = segments.length;
    let done = 0;
    let failed = 0;

    console.log(`[hls] ${total} segments — ${concurrency} workers parallèles`);
    if (onProgress) onProgress({ done, total, failed, percent: 0 });

    // Queue de segments à traiter
    const queue = segments.map((url, i) => ({ url, i }));

    const worker = async () => {
      while (queue.length > 0) {
        if (signal?.aborted) return;
        const { url, i } = queue.shift();
        const segPath = join(tmpDir, `seg_${String(i).padStart(6, "0")}.ts`);
        const ok = await downloadSegment(url, segPath, signal);
        done++;
        if (!ok) failed++;
        if (onProgress) {
          onProgress({ done, total, failed, percent: Math.round((done / total) * 100) });
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));

    if (signal?.aborted) {
      throw Object.assign(new Error("Download aborted"), { cancelled: true });
    }

    const successCount = done - failed;
    console.log(`[hls] Téléchargement: ${successCount}/${total} segments OK, ${failed} échoués`);

    if (successCount === 0) {
      throw new Error("Aucun segment téléchargé");
    }

    // Construction de la liste de concat pour ffmpeg
    const files = (await readdir(tmpDir))
      .filter((f) => f.endsWith(".ts"))
      .sort();

    const concatFile = join(tmpDir, "concat.txt");
    await writeFile(
      concatFile,
      files.map((f) => `file '${join(tmpDir, f).replace(/\\/g, "/")}'`).join("\n")
    );

    // Fusion des segments en MP4 via ffmpeg
    await new Promise((resolve, reject) => {
      const proc = spawnProcess(config.ffmpegPath, [
        "-f", "concat",
        "-safe", "0",
        "-i", concatFile,
        "-c", "copy",
        "-y",
        outputPath,
      ]);
      let errBuf = "";
      proc.stderr.on("data", (d) => { errBuf += d; });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg concat échoué (code ${code}): ${errBuf.slice(-300)}`));
      });
    });

    return { total, downloaded: successCount, failed };
  } finally {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
