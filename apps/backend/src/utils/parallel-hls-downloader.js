// Téléchargeur HLS parallèle v2 — stream vers un fichier .ts unique (pas 8000 fichiers).
// Workers parallèles + Agent HTTP keep-alive + backpressure mémoire bornée.
// Benchmark sur stream Apple : 1 worker=7.5 MB/s, 4=22 MB/s, 8=29 MB/s, 16=34 MB/s → défaut 16.

import { createWriteStream } from "fs";
import { unlink, mkdir } from "fs/promises";
import { dirname } from "path";
import { get as httpsGet } from "https";
import { get as httpGet } from "http";
import { Agent as HttpsAgent } from "https";
import { Agent as HttpAgent } from "http";
import { spawnProcess } from "./subprocess.js";
import { config } from "../config.js";

const MAX_RETRIES = 6;
// Segments gardés en RAM avant que le writer les consomme.
// 16 workers × 4 = ~64 segments × ~4.5 MB = ~290 MB max.
const BACKPRESSURE_LIMIT = 64;

// Agents keep-alive : réutilise les connexions TCP entre segments (réduit la latence ~20%).
const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 32 });
const httpAgent  = new HttpAgent ({ keepAlive: true, maxSockets: 64, maxFreeSockets: 32 });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchSegmentRaw(url, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error("Aborted"), { cancelled: true }));

    const getter = url.startsWith("https") ? httpsGet : httpGet;
    const agent  = url.startsWith("https") ? httpsAgent : httpAgent;

    const req = getter(url, { agent }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });

    req.setTimeout(30_000, () => { req.destroy(new Error("Timeout")); });
    req.on("error", (err) => reject(err));

    if (signal) {
      signal.addEventListener("abort", () => {
        req.destroy();
        reject(Object.assign(new Error("Aborted"), { cancelled: true }));
      }, { once: true });
    }
  });
}

async function fetchWithRetry(url, signal) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw Object.assign(new Error("Aborted"), { cancelled: true });
    try {
      return await fetchSegmentRaw(url, signal);
    } catch (err) {
      if (err.cancelled) throw err;
      if (attempt === MAX_RETRIES - 1) throw err;
      await sleep(500 * Math.pow(2, attempt)); // 500ms, 1s, 2s, 4s, 8s, 16s
    }
  }
}

async function parseM3U8(playlistUrl, signal) {
  const buf = await fetchWithRetry(playlistUrl, signal);
  const text = buf.toString("utf-8");
  const base = playlistUrl.substring(0, playlistUrl.lastIndexOf("/") + 1);

  // Master manifest → résoudre la première sous-playlist
  if (text.includes("#EXT-X-STREAM-INF")) {
    const subUrl = text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#"));
    if (!subUrl) throw new Error("Master manifest sans sous-playlist");
    return parseM3U8(subUrl.startsWith("http") ? subUrl : base + subUrl, signal);
  }

  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => (l.startsWith("http") ? l : base + l));
}

/**
 * Télécharge un flux HLS en parallèle et produit un fichier MP4 final.
 * Stratégie : N workers → buffers indexés → writer séquentiel → .ts unique → ffmpeg → .mp4
 *
 * @param {string}      playlistUrl          URL du m3u8 (media ou master)
 * @param {string}      outputPath           Chemin du fichier .mp4 de sortie
 * @param {number}      [options.concurrency=16]   Nombre de workers parallèles
 * @param {AbortSignal} [options.signal]     Signal d'annulation
 * @param {Function}    [options.onProgress] Callback({ done, total, failed, percent })
 */
export async function downloadHLSParallel(playlistUrl, outputPath, {
  concurrency = 16,
  signal = null,
  onProgress = null,
} = {}) {
  await mkdir(dirname(outputPath), { recursive: true });

  const segments = await parseM3U8(playlistUrl, signal);
  const total = segments.length;

  console.log(`[hls] ${total} segments — ${concurrency} workers — stream TS unique`);
  if (onProgress) onProgress({ done: 0, total, failed: 0, percent: 0 });

  const tsPath = outputPath + ".ts.tmp";
  const writeStream = createWriteStream(tsPath);

  const bufferMap = new Map();
  let nextWriteIdx = 0;
  let done = 0;
  let failed = 0;

  // Mécanisme de wake-up du writer quand un nouveau buffer est disponible
  let writerWake = null;
  const notify = () => { if (writerWake) { writerWake(); writerWake = null; } };
  const waitNotif = () => new Promise((r) => { writerWake = r; });

  // Writer séquentiel : consomme bufferMap dans l'ordre et stream vers le .ts
  const writerLoop = async () => {
    while (nextWriteIdx < total) {
      // Si annulé, on sort immédiatement sans attendre des buffers qui n'arriveront plus
      if (signal?.aborted) {
        writeStream.destroy();
        return;
      }
      const buf = bufferMap.get(nextWriteIdx);
      if (buf !== undefined) {
        if (buf.length > 0) {
          const drained = writeStream.write(buf);
          if (!drained) await new Promise((r) => writeStream.once("drain", r));
        }
        bufferMap.delete(nextWriteIdx);
        nextWriteIdx++;
      } else {
        await Promise.race([waitNotif(), sleep(50)]);
      }
    }
    if (!signal?.aborted) {
      await new Promise((r) => writeStream.end(r));
    }
  };

  // Workers : téléchargent les segments en parallèle
  const queue = segments.map((url, i) => ({ url, i }));

  const worker = async () => {
    while (queue.length > 0) {
      if (signal?.aborted) return;

      // Backpressure : ne pas exploser la RAM si le writer est en retard
      while (bufferMap.size >= BACKPRESSURE_LIMIT) {
        await sleep(20);
      }

      const task = queue.shift();
      if (!task) continue;

      try {
        const buf = await fetchWithRetry(task.url, signal);
        bufferMap.set(task.i, buf);
        done++;
      } catch (err) {
        if (err.cancelled) return;
        failed++;
        done++;
        // Slot vide pour ne pas bloquer le writer sur ce segment
        bufferMap.set(task.i, Buffer.alloc(0));
        console.error(`[hls] Segment ${task.i} abandonné après ${MAX_RETRIES} tentatives`);
      }

      notify();
      if (onProgress) {
        onProgress({ done, total, failed, percent: Math.round((done / total) * 100) });
      }
    }
  };

  try {
    const workersPromise = Promise.all(Array.from({ length: concurrency }, worker))
      .then(() => notify()); // Réveiller le writer quand tous les workers sont finis (ex: abort)

    await Promise.all([writerLoop(), workersPromise]);

    if (signal?.aborted) {
      throw Object.assign(new Error("Download aborted"), { cancelled: true });
    }

    const ok = done - failed;
    console.log(`[hls] Stream: ${ok}/${total} OK${failed ? `, ${failed} échoués` : ""} — conversion MP4…`);

    if (ok === 0) throw new Error("Aucun segment téléchargé");

    // Conversion .ts → .mp4 (stream copy, quelques secondes)
    await new Promise((resolve, reject) => {
      const proc = spawnProcess(config.ffmpegPath, [
        "-i", tsPath,
        "-c", "copy",
        "-y",
        outputPath,
      ]);
      let errBuf = "";
      proc.stderr.on("data", (d) => { errBuf += d; });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg failed (${code}): ${errBuf.slice(-300)}`));
      });
    });

    return { total, downloaded: ok, failed };
  } finally {
    try { await unlink(tsPath); } catch {}
  }
}
