// Usage: node apps/backend/scripts/test-bypass.js <twitch_vod_url>
// Exemple: node apps/backend/scripts/test-bypass.js https://www.twitch.tv/videos/2345678901
//
// Vérifie que le bypass CloudFront fonctionne sur une VOD (y compris sub-only).
// Affiche l'URL m3u8 directe résolue, sans lancer de téléchargement.

import { getTwitchVODDirectUrl, extractVODId } from "../src/utils/twitch-vod-bypass.js";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node test-bypass.js <twitch_vod_url>");
  process.exit(1);
}

const vodId = extractVODId(url);
if (!vodId) {
  console.error("URL invalide — attendu: https://www.twitch.tv/videos/<id>");
  process.exit(1);
}

console.log(`\nTest bypass VOD ${vodId}...\n`);

try {
  const { url: m3u8, title, channelLogin } = await getTwitchVODDirectUrl(vodId, "source");
  console.log(`Chaine   : ${channelLogin}`);
  console.log(`Titre    : ${title}`);
  console.log(`M3U8 URL : ${m3u8}`);
  console.log("\n[OK] Bypass reussi — VOD accessible sans authentification.");
} catch (err) {
  console.error(`[ECHEC] ${err.message}`);
  process.exit(1);
}
