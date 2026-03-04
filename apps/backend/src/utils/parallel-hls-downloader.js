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
const BACKPRESSURE_LIMIT = 64;

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
      await sleep(500 * Math.pow(2, attempt));
    }
  }
}

async function parseM3U8(playlistUrl, signal) {
  const buf = await fetchWithRetry(playlistUrl, signal);
  const text = buf.toString("utf-8");
  const base = playlistUrl.substring(0, playlistUrl.lastIndexOf("/") + 1);

  const resolve = (u) => (u.startsWith("http") ? u : base + u);

  if (text.includes("#EXT-X-STREAM-INF")) {
    const subUrl = text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("#"));
    if (!subUrl) throw new Error("Master manifest sans sous-playlist");
    return parseM3U8(resolve(subUrl), signal);
  }

  let initUrl = null;
  const mapMatch = text.match(/#EXT-X-MAP:URI="([^"]+)"/);
  if (mapMatch) initUrl = resolve(mapMatch[1]);

  const segments = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map(resolve);

  return { segments, initUrl };
}

export async function downloadHLSParallel(playlistUrl, outputPath, {
  concurrency = 16,
  signal = null,
  onProgress = null,
} = {}) {
  await mkdir(dirname(outputPath), { recursive: true });

  const { segments, initUrl } = await parseM3U8(playlistUrl, signal);
  const total = segments.length;
  const format = initUrl ? "fMP4" : "TS";

  console.log(`[hls] ${total} segments — ${concurrency} workers — format ${format}${initUrl ? " (init segment détecté)" : ""}`);
  if (onProgress) onProgress({ done: 0, total, failed: 0, percent: 0 });

  const tsPath = outputPath + ".ts.tmp";
  const writeStream = createWriteStream(tsPath);

  if (initUrl) {
    const initBuf = await fetchWithRetry(initUrl, signal);
    writeStream.write(initBuf);
  }

  const bufferMap = new Map();
  let nextWriteIdx = 0;
  let done = 0;
  let failed = 0;

  let writerWake = null;
  const notify = () => { if (writerWake) { writerWake(); writerWake = null; } };
  const waitNotif = () => new Promise((r) => { writerWake = r; });

  const writerLoop = async () => {
    while (nextWriteIdx < total) {
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

  const queue = segments.map((url, i) => ({ url, i }));

  const worker = async () => {
    while (queue.length > 0) {
      if (signal?.aborted) return;

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
      .then(() => notify());

    await Promise.all([writerLoop(), workersPromise]);

    if (signal?.aborted) {
      throw Object.assign(new Error("Download aborted"), { cancelled: true });
    }

    const ok = done - failed;
    console.log(`[hls] Stream: ${ok}/${total} OK${failed ? `, ${failed} échoués` : ""} — conversion MP4…`);

    if (ok === 0) throw new Error("Aucun segment téléchargé");

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
