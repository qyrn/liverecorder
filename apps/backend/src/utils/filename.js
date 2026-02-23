import { mkdirSync } from "fs";
import { join } from "path";
import { config } from "../config.js";

export function buildFilename({ platform, streamerName, recordingId }) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = (streamerName || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safePlatform = platform.replace(/[^a-zA-Z0-9]/g, "_");
  return `${safePlatform}_${safeName}_${date}_${recordingId}.mp4`;
}

export function buildFilepath({ platform, streamerName, recordingId }) {
  mkdirSync(config.outputPath, { recursive: true });
  return join(config.outputPath, buildFilename({ platform, streamerName, recordingId }));
}
