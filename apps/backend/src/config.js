import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  outputPath: resolve(root, process.env.OUTPUT_PATH || "./recordings"),
  ytdlpPath: process.env.YTDLP_PATH || "C:/yt-dlp/yt-dlp.exe",
  ffmpegPath: process.env.FFMPEG_PATH || "C:/ffmpeg/bin/ffmpeg.exe",
  streamlinkPath: process.env.STREAMLINK_PATH || "streamlink",
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || "",
    clientSecret: process.env.TWITCH_CLIENT_SECRET || "",
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || "",
  },
  poll: {
    twitch: parseInt(process.env.POLL_INTERVAL_TWITCH || "60", 10),
    youtube: parseInt(process.env.POLL_INTERVAL_YOUTUBE || "300", 10),
    tiktok: parseInt(process.env.POLL_INTERVAL_TIKTOK || "120", 10),
  },
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || "3", 10),
  dbPath: resolve(root, "liverecorder.db"),
};
