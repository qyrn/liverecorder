import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);
const router = Router();

async function checkTool(path, args) {
  try {
    await execFileAsync(path, args, { timeout: 5000 });
    return { ok: true };
  } catch (err) {
    if (err.code === "ENOENT") return { ok: false, error: "not found" };
    return { ok: true };
  }
}

router.get("/", async (req, res) => {
  const [ytdlp, ffmpeg, streamlink] = await Promise.all([
    checkTool(config.ytdlpPath, ["--version"]),
    checkTool(config.ffmpegPath, ["-version"]),
    checkTool(config.streamlinkPath, ["--version"]),
  ]);

  res.json({
    ytdlp,
    ffmpeg,
    streamlink,
    twitch: { configured: !!(config.twitch.clientId && config.twitch.clientSecret) },
    youtube: { configured: !!config.youtube.apiKey },
  });
});

export default router;
