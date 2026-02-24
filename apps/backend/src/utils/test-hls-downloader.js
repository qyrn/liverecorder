#!/usr/bin/env node
// Test du téléchargeur HLS parallèle.
// Usage : node apps/backend/src/utils/test-hls-downloader.js [url_m3u8]
//
// Sans argument → utilise un stream de test public Apple (court, ~10 segments).
// Avec argument  → télécharge l'URL donnée (ex: URL CloudFront d'une VOD Twitch).

import { existsSync, statSync, unlinkSync } from "fs";
import { downloadHLSParallel } from "./parallel-hls-downloader.js";

// Stream de test Apple : media playlist directe (~10 segments ~800 KB chacun = ~8 MB total)
const TEST_M3U8 = "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/gear1/prog_index.m3u8";
const OUT_PATH  = "./test-hls-output.mp4";

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function bar(percent, width = 30) {
  const filled = Math.round((percent / 100) * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

async function runTest(label, url, concurrency, signal = null) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`TEST : ${label}`);
  console.log(`URL  : ${url.slice(0, 80)}…`);
  console.log(`Concurrence : ${concurrency} workers`);
  console.log("─".repeat(60));

  const t0 = Date.now();
  let lastPct = -1;

  try {
    const result = await downloadHLSParallel(url, OUT_PATH, {
      concurrency,
      signal,
      onProgress: ({ done, total, failed, percent }) => {
        if (percent !== lastPct && percent % 10 === 0) {
          lastPct = percent;
          process.stdout.write(`\r  ${bar(percent)} ${percent}%  (${done}/${total})`);
        }
      },
    });

    process.stdout.write("\n");
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    if (!existsSync(OUT_PATH)) throw new Error("Fichier de sortie absent !");
    const size = statSync(OUT_PATH).size;
    if (size < 1024) throw new Error(`Fichier trop petit (${size} bytes) — probablement corrompu`);

    const throughput = (size / (Date.now() - t0) * 1000 / 1024 / 1024).toFixed(1);

    console.log(`  ✓ Durée     : ${elapsed}s`);
    console.log(`  ✓ Taille    : ${fmt(size)}`);
    console.log(`  ✓ Débit     : ${throughput} MB/s`);
    console.log(`  ✓ Segments  : ${result.downloaded}/${result.total} OK${result.failed ? `, ${result.failed} échoués` : ""}`);
    console.log(`  ✓ SUCCÈS`);
    return true;
  } catch (err) {
    process.stdout.write("\n");
    if (err.cancelled) {
      console.log(`  ✓ Annulation propre (AbortController OK)`);
      return true;
    }
    console.error(`  ✗ ÉCHEC : ${err.message}`);
    return false;
  } finally {
    try { if (existsSync(OUT_PATH)) unlinkSync(OUT_PATH); } catch {}
  }
}

async function testCancellation(url) {
  console.log(`\n${"─".repeat(60)}`);
  console.log("TEST : Annulation après 500ms (1 worker pour ralentir)");
  console.log("─".repeat(60));

  const ac = new AbortController();
  setTimeout(() => {
    console.log("  → abort() déclenché");
    ac.abort();
  }, 500);

  const t0 = Date.now();
  try {
    await downloadHLSParallel(url, OUT_PATH, {
      concurrency: 1,   // 1 worker intentionnel : ~6s pour ce stream, abort à 500ms
      signal: ac.signal,
    });
    console.log("  ✗ Le download aurait dû être annulé !");
    return false;
  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    if (err.cancelled) {
      console.log(`  ✓ Annulation après ${elapsed}s — propre, pas de fuite`);
      if (existsSync(OUT_PATH)) {
        console.error("  ✗ Fichier de sortie présent après annulation — nettoyage manquant");
        unlinkSync(OUT_PATH);
        return false;
      }
      return true;
    }
    console.error(`  ✗ Erreur inattendue : ${err.message}`);
    return false;
  }
}

async function benchmarkConcurrency(url) {
  console.log(`\n${"═".repeat(60)}`);
  console.log("BENCHMARK : comparaison des niveaux de concurrence");
  console.log("═".repeat(60));

  const results = [];
  for (const n of [1, 4, 8, 16]) {
    const t0 = Date.now();
    try {
      const r = await downloadHLSParallel(url, OUT_PATH, { concurrency: n });
      const elapsed = (Date.now() - t0) / 1000;
      const size = existsSync(OUT_PATH) ? statSync(OUT_PATH).size : 0;
      const mbps = ((size / elapsed) / 1024 / 1024).toFixed(1);
      results.push({ n, elapsed: elapsed.toFixed(1), mbps, ok: true });
      console.log(`  workers=${n.toString().padStart(2)}  →  ${elapsed.toFixed(1)}s  ${mbps} MB/s`);
    } catch (err) {
      results.push({ n, ok: false, err: err.message });
      console.log(`  workers=${n.toString().padStart(2)}  →  ÉCHEC: ${err.message}`);
    } finally {
      try { if (existsSync(OUT_PATH)) unlinkSync(OUT_PATH); } catch {}
    }
  }

  const best = results.filter(r => r.ok).sort((a, b) => parseFloat(a.elapsed) - parseFloat(b.elapsed))[0];
  if (best) console.log(`\n  Meilleure concurrence : ${best.n} workers (${best.elapsed}s)`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const customUrl = process.argv[2];
const targetUrl = customUrl ?? TEST_M3U8;
let allOk = true;

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║         TEST SUITE — parallel-hls-downloader            ║");
console.log("╚══════════════════════════════════════════════════════════╝");

// Test 1 : téléchargement normal
allOk &= await runTest("Téléchargement standard (8 workers)", targetUrl, 8);

// Test 2 : annulation propre
allOk &= await testCancellation(targetUrl);

// Test 3 : benchmark concurrence (uniquement sur le stream de test court)
if (!customUrl) {
  await benchmarkConcurrency(targetUrl);
}

console.log(`\n${"═".repeat(60)}`);
console.log(allOk ? "RÉSULTAT : ✓ Tous les tests passés" : "RÉSULTAT : ✗ Des tests ont échoué");
console.log("═".repeat(60));

process.exit(allOk ? 0 : 1);
