import { getDb } from "../db/client.js";
import { config } from "../config.js";
import { isRecording, startRecording, onRecordingEnd } from "./recorder.js";
import { checkLive as twitchCheck } from "./platforms/twitch.js";
import { checkLive as youtubeCheck } from "./platforms/youtube.js";
import { checkLive as tiktokCheck } from "./platforms/tiktok.js";

const checkers = {
  twitch: twitchCheck,
  youtube: youtubeCheck,
  tiktok: tiktokCheck,
};

const intervals = new Map();
let onRecordingStarted = null;
let onRecordingEndedCb = null;

async function checkStreamer(streamer) {
  const checker = checkers[streamer.platform];
  if (!checker) return;

  let result;
  try {
    result = await checker(streamer.identifier);
  } catch (err) {
    console.error(`[monitor] ${streamer.platform}/${streamer.identifier} check failed:`, err.message);
    return;
  }

  if (!result) return;
  if (isRecording(streamer.id)) return;

  try {
    const recordingId = await startRecording({
      streamerId: streamer.id,
      platform: streamer.platform,
      streamUrl: result.url,
      streamTitle: result.title,
      streamerName: streamer.name,
      trigger: "auto",
    });

    console.log(`[monitor] Started recording #${recordingId} for ${streamer.name} (${streamer.platform})`);

    if (onRecordingStarted) {
      onRecordingStarted(recordingId, {
        streamerId: streamer.id,
        streamerName: streamer.name,
        platform: streamer.platform,
        streamTitle: result.title,
        url: result.url,
      });
    }

    if (onRecordingEndedCb) {
      onRecordingEnd(recordingId, (id, finalData) => {
        onRecordingEndedCb(id, finalData);
      });
    }
  } catch (err) {
    console.error(`[monitor] Failed to start recording for ${streamer.name}:`, err.message);
  }
}

function pollPlatform(platform) {
  const db = getDb();
  const streamers = db
    .prepare("SELECT * FROM streamers WHERE platform = ? AND enabled = 1")
    .all(platform);

  for (const streamer of streamers) {
    checkStreamer(streamer).catch(() => {});
  }
}

export function startMonitor({ onStarted, onEnded } = {}) {
  onRecordingStarted = onStarted ?? null;
  onRecordingEndedCb = onEnded ?? null;

  const platformIntervals = {
    twitch: config.poll.twitch * 1000,
    youtube: config.poll.youtube * 1000,
    tiktok: config.poll.tiktok * 1000,
  };

  for (const [platform, ms] of Object.entries(platformIntervals)) {
    pollPlatform(platform);
    const id = setInterval(() => pollPlatform(platform), ms);
    intervals.set(platform, id);
  }

  console.log("[monitor] Started — intervals: Twitch=%ds YouTube=%ds TikTok=%ds",
    config.poll.twitch, config.poll.youtube, config.poll.tiktok);
}

export function stopMonitor() {
  for (const id of intervals.values()) clearInterval(id);
  intervals.clear();
}
