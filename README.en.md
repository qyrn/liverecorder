# LiveRecorder — Documentation EN

> [Central README](./README.md) · [Français](./README.fr.md)

Local stream recorder — Twitch, YouTube, TikTok — for Windows. No cloud, no account, no artificial limits.

---

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Launch](#launch)
- [Supported platforms](#supported-platforms)
- [Features](#features)
- [Settings](#settings)
- [Benchmark](#benchmark)
- [License](#license)

---

## Requirements

- Windows 10 or 11
- [Node.js](https://nodejs.org) >= 18
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — placed at `C:\yt-dlp\yt-dlp.exe`
- [ffmpeg](https://ffmpeg.org/download.html) — placed at `C:\ffmpeg\bin\ffmpeg.exe`

Quick install via winget:

```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

> Paths can be customized in the **Settings** tab of the dashboard.

---

## Installation

```powershell
git clone https://github.com/qyrn/liverecorder
cd liverecorder
```

---

## Launch

**Double-click** `start.bat` — the script checks your environment, installs Node.js dependencies and opens the dashboard in your browser.

Or from PowerShell:

```powershell
.\start.ps1
```

The script prompts for interface language (FR/EN) at startup. The dashboard opens at `http://localhost:3000`.

---

## Supported platforms

### Twitch

Downloads VODs, highlights and clips. Includes a **subscriber-only bypass**: restricted VODs are accessible without a subscription by directly reconstructing CloudFront URLs (same mechanism as TwitchNoSub).

```
https://www.twitch.tv/videos/2703786928
```

### YouTube

All qualities up to 4K via yt-dlp.

```
https://www.youtube.com/watch?v=...
```

### TikTok

Videos and lives via yt-dlp.

```
https://www.tiktok.com/@user/video/...
```

---

## Features

**Parallel HLS downloader**
16 workers download segments in parallel for Twitch VODs. Average throughput: 47–65 MB/s.

**Twitch subscriber-only bypass**
Reconstructs the direct CloudFront URL from Twitch's public GraphQL API. No subscription token required.

**Local web dashboard**
React interface available at `http://localhost:3000`. Shows real-time progress via WebSocket, paginated history and settings.

**100% local**
No data ever leaves your machine. No account, no cloud, no telemetry.

**Bilingual interface**
The dashboard and landing page support French and English. The language chosen at script startup is stored via `localStorage` and the `?lang=fr/en` URL parameter.

---

## Settings

Accessible via the **Settings** button in the dashboard.

| Setting | Description | Default |
|---------|-------------|---------|
| `ytdlp_path` | Path to yt-dlp.exe | `C:\yt-dlp\yt-dlp.exe` |
| `ffmpeg_path` | Path to ffmpeg.exe | `C:\ffmpeg\bin\ffmpeg.exe` |
| `output_path` | Output folder for recordings | `./recordings` |
| `quality_preset` | Max quality (`source`, `1080p`, `720p`, `480p`) | `source` |
| `max_concurrent` | Concurrent downloads | `3` |
| `hls_concurrency` | Parallel HLS workers (Twitch bypass) | `16` |
| `ytdlp_concurrent_fragments` | Concurrent yt-dlp fragments | `4` |

---

## Benchmark

Measured on 24 February 2026 on a local connection.

### Test 1 — grimkujow · h264 1080p · TS

| Field | Value |
|-------|-------|
| VOD | `twitch.tv/videos/2703786928` |
| Content duration | 10h34 |
| File size | 28 GB |
| Total time | **9 min** |
| Average speed | 47.9 MB/s |
| Codec | h264 1920×1080 · aac 44100 Hz |
| Segments | 3804/3804 (0 failed) |

### Test 2 — hugodelire · hevc 2560×1440 · fMP4

| Field | Value |
|-------|-------|
| VOD | `twitch.tv/videos/2704064307` |
| Content duration | 3h35 |
| File size | 13.8 GB |
| Total time | **3 min 35 s** |
| Average speed | **65.5 MB/s** |
| Codec | hevc H.265 2560×1440 · aac 48000 Hz |
| Segments | 1292/1292 (0 failed) |

---

## License

MIT — see [LICENSE](./LICENSE)
