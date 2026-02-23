import { mkdirSync } from "fs";
import { join } from "path";
import { config } from "../config.js";

const FORBIDDEN = /[\\/:*?"<>|]/g;

function sanitize(str, maxLen = 60) {
  return str
    .replace(FORBIDDEN, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen)
    .trimEnd();
}

export function buildFilename({ platform, streamerName, streamTitle, recordingId }) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const time = `${hh}h${mm}`;

  const pf = sanitize(platform, 20) || "unknown";
  const name = sanitize(streamerName || "unknown", 40);
  const title = streamTitle ? ` - ${sanitize(streamTitle, 60)}` : "";

  return `[${pf}] ${name}${title} ${date} ${time} (${recordingId}).mp4`;
}

export function buildFilepath({ platform, streamerName, streamTitle, recordingId }) {
  mkdirSync(config.outputPath, { recursive: true });
  return join(config.outputPath, buildFilename({ platform, streamerName, streamTitle, recordingId }));
}
