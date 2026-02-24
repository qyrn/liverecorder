#!/usr/bin/env node
// Test end-to-end d'une VOD Twitch : bypass CloudFront + download parallèle HLS.
// Usage : node apps/backend/src/utils/test-twitch-vod.js <url_twitch_vod>

import { existsSync, statSync, unlinkSync } from "fs";
import { getTwitchVODDirectUrl, extractVODId } from "./twitch-vod-bypass.js";
import { downloadHLSParallel } from "./parallel-hls-downloader.js";

const VOD_URL = process.argv[2];
if (!VOD_URL) {
  console.error("Usage : node test-twitch-vod.js <url_twitch_vod>");
  process.exit(1);
}

const vodId = extractVODId(VOD_URL);
if (!vodId) {
  console.error("URL invalide — format attendu : https://www.twitch.tv/videos/XXXXXX");
  process.exit(1);
}

const OUT = `./test-vod-${vodId}.mp4`;

function fmt(bytes) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m${rem.toString().padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, "0")}m`;
}

function bar(pct, w = 40) {
  const f = Math.round((pct / 100) * w);
  return "[" + "█".repeat(f) + "░".repeat(w - f) + "]";
}

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║           TEST VOD TWITCH — download parallèle           ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log(`VOD ID : ${vodId}`);
console.log(`URL    : ${VOD_URL}`);
console.log();

// ─── Étape 1 : bypass CloudFront ────────────────────────────────────────────
console.log("── Étape 1/3 : résolution de l'URL CloudFront…");
let m3u8Url, title, channelLogin;
try {
  const t0 = Date.now();
  ({ url: m3u8Url, title, channelLogin } = await getTwitchVODDirectUrl(vodId, "source"));
  console.log(`  ✓ ${Date.now() - t0}ms — ${channelLogin} — "${title}"`);
  console.log(`  URL : ${m3u8Url.split("/").slice(0, 6).join("/")}…`);
} catch (err) {
  console.error(`  ✗ Bypass échoué : ${err.message}`);
  process.exit(1);
}

// ─── Étape 2 : download parallèle ───────────────────────────────────────────
console.log("\n── Étape 2/3 : téléchargement HLS (16 workers)…");

const t0 = Date.now();
let lastPct = -1;
let lastDone = 0;
let lastTime = t0;
let etaStr = "calcul…";

try {
  const result = await downloadHLSParallel(m3u8Url, OUT, {
    concurrency: 16,
    onProgress: ({ done, total, failed, percent }) => {
      const now = Date.now();

      // Calcul ETA toutes les 50 segments
      if (done - lastDone >= 50) {
        const elapsed = now - lastTime;
        const rate = (done - lastDone) / elapsed; // segments/ms
        const remaining = total - done;
        etaStr = rate > 0 ? `ETA ${fmtTime(remaining / rate)}` : "…";
        lastDone = done;
        lastTime = now;
      }

      if (percent !== lastPct) {
        lastPct = percent;
        const speed = existsSync(OUT) ? `${fmt(statSync(OUT).size)}` : "—";
        process.stdout.write(
          `\r  ${bar(percent)} ${String(percent).padStart(3)}%  ${done}/${total}${failed ? `  ✗${failed}` : ""}  ${etaStr}   `
        );
      }
    },
  });

  process.stdout.write("\n");
  const elapsed = Date.now() - t0;
  const size = existsSync(OUT) ? statSync(OUT).size : 0;
  const throughput = size > 0 ? (size / (elapsed / 1000) / 1024 / 1024).toFixed(1) : "0";

  console.log(`\n  ✓ Durée      : ${fmtTime(elapsed)}`);
  console.log(`  ✓ Taille     : ${fmt(size)}`);
  console.log(`  ✓ Débit moy. : ${throughput} MB/s`);
  console.log(`  ✓ Segments   : ${result.downloaded}/${result.total}${result.failed ? `  (${result.failed} échoués)` : " — tous OK"}`);

  if (size < 1024 * 1024) {
    throw new Error(`Fichier trop petit (${fmt(size)}) — probable corruption`);
  }
} catch (err) {
  process.stdout.write("\n");
  console.error(`  ✗ Échec download : ${err.message}`);
  if (existsSync(OUT)) unlinkSync(OUT);
  process.exit(1);
}

// ─── Étape 3 : vérification du fichier ──────────────────────────────────────
console.log("\n── Étape 3/3 : vérification intégrité (ffprobe)…");
import { execFileSync } from "child_process";

const ffprobePath = process.env.FFMPEG_PATH
  ? process.env.FFMPEG_PATH.replace("ffmpeg.exe", "ffprobe.exe")
  : "C:/ffmpeg/bin/ffprobe.exe";

try {
  const out = execFileSync(ffprobePath, [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    OUT,
  ], { encoding: "utf-8" });

  const info = JSON.parse(out);
  const duration = parseFloat(info.format?.duration ?? 0);
  const streams = info.streams ?? [];
  const video = streams.find(s => s.codec_type === "video");
  const audio = streams.find(s => s.codec_type === "audio");

  console.log(`  ✓ Durée vidéo  : ${fmtTime(duration * 1000)}`);
  console.log(`  ✓ Vidéo        : ${video ? `${video.codec_name} ${video.width}×${video.height}` : "absent"}`);
  console.log(`  ✓ Audio        : ${audio ? `${audio.codec_name} ${audio.sample_rate}Hz` : "absent"}`);
  console.log(`  ✓ Bitrate      : ${info.format?.bit_rate ? `${(info.format.bit_rate / 1000).toFixed(0)} kbps` : "inconnu"}`);

  if (duration < 3600) {
    console.warn(`  ⚠ Durée < 1h (${fmtTime(duration * 1000)}) — vérifier si la VOD est bien complète`);
  }
} catch (err) {
  console.warn(`  ⚠ ffprobe indisponible ou erreur : ${err.message}`);
}

if (existsSync(OUT)) unlinkSync(OUT);
console.log("\n╔══════════════════════════════════════╗");
console.log("║  ✓ TEST COMPLET — aucun crash détecté  ║");
console.log("╚══════════════════════════════════════╝");
