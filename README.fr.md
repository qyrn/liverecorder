# LiveRecorder — Documentation FR

> [README central](./README.md) · [English](./README.en.md)

Enregistreur local de streams — Twitch, YouTube, TikTok — pour Windows. Aucun cloud, aucun compte, aucune limite artificielle.

---

## Sommaire

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Lancement](#lancement)
- [Plateformes supportées](#plateformes-supportées)
- [Fonctionnalités](#fonctionnalités)
- [Paramètres](#paramètres)
- [Benchmark](#benchmark)
- [Licence](#licence)

---

## Prérequis

- Windows 10 ou 11
- [Node.js](https://nodejs.org) >= 18
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — placé dans `C:\yt-dlp\yt-dlp.exe`
- [ffmpeg](https://ffmpeg.org/download.html) — placé dans `C:\ffmpeg\bin\ffmpeg.exe`

Installation rapide via winget :

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

> Les chemins sont personnalisables dans l'onglet **Paramètres** de l'interface.

---

## Installation

```powershell
git clone https://github.com/qyrn/liverecorder
cd liverecorder
```

---

## Lancement

**Double-clic** sur `start.bat` — le script vérifie l'environnement, installe les dépendances Node.js et ouvre le dashboard dans le navigateur.

Ou depuis PowerShell :

```powershell
.\start.ps1
```

Le script demande la langue de l'interface (FR/EN) au démarrage. Le dashboard s'ouvre sur `http://localhost:3000`.

---

## Plateformes supportées

### Twitch

Téléchargement de VODs, highlights et clips. Inclut un **bypass subscriber-only** : les VODs réservés aux abonnés sont accessibles sans abonnement via reconstruction directe des URLs CloudFront (même mécanisme que TwitchNoSub).

```
https://www.twitch.tv/videos/2703786928
```

### YouTube

Toutes qualités jusqu'à 4K via yt-dlp.

```
https://www.youtube.com/watch?v=...
```

### TikTok

Vidéos et lives via yt-dlp.

```
https://www.tiktok.com/@user/video/...
```

---

## Fonctionnalités

**Téléchargeur HLS parallèle**
16 workers téléchargent les segments en parallèle pour les VODs Twitch. Débit moyen : 47–65 MB/s.

**Bypass Twitch subscriber-only**
Reconstruction de l'URL CloudFront directe depuis l'API GraphQL publique de Twitch. Aucun token d'abonnement requis.

**Dashboard web local**
Interface React accessible sur `http://localhost:3000`. Affiche la progression en temps réel via WebSocket, l'historique paginé et les paramètres.

**100 % local**
Aucune donnée ne quitte la machine. Pas de compte, pas de cloud, pas de télémétrie.

**Langue de l'interface**
Le dashboard et la landing page supportent le français et l'anglais. La langue choisie au lancement du script est mémorisée via `localStorage` et le paramètre `?lang=fr/en`.

---

## Paramètres

Accessibles via le bouton **Paramètres** dans le dashboard.

| Paramètre | Description | Défaut |
|-----------|-------------|--------|
| `ytdlp_path` | Chemin vers yt-dlp.exe | `C:\yt-dlp\yt-dlp.exe` |
| `ffmpeg_path` | Chemin vers ffmpeg.exe | `C:\ffmpeg\bin\ffmpeg.exe` |
| `output_path` | Dossier de sortie des fichiers | `./recordings` |
| `quality_preset` | Qualité maximale (`source`, `1080p`, `720p`, `480p`) | `source` |
| `max_concurrent` | Téléchargements simultanés | `3` |
| `hls_concurrency` | Workers HLS parallèles (Twitch bypass) | `16` |
| `ytdlp_concurrent_fragments` | Fragments simultanés yt-dlp | `4` |

---

## Benchmark

Mesures effectuées le 24 février 2026 sur une connexion locale.

### Test 1 — grimkujow · h264 1080p · TS

| Champ | Valeur |
|-------|--------|
| VOD | `twitch.tv/videos/2703786928` |
| Durée contenu | 10h34 |
| Taille fichier | 28 GB |
| Temps total | **9 min** |
| Débit moyen | 47.9 MB/s |
| Codec | h264 1920×1080 · aac 44100 Hz |
| Segments | 3804/3804 (0 échec) |

### Test 2 — hugodelire · hevc 2560×1440 · fMP4

| Champ | Valeur |
|-------|--------|
| VOD | `twitch.tv/videos/2704064307` |
| Durée contenu | 3h35 |
| Taille fichier | 13.8 GB |
| Temps total | **3 min 35 s** |
| Débit moyen | **65.5 MB/s** |
| Codec | hevc H.265 2560×1440 · aac 48000 Hz |
| Segments | 1292/1292 (0 échec) |

---

## Licence

MIT — voir [LICENSE](./LICENSE)
