import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { getDb } from "../db/client.js";

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
  const db = getDb();
  const rows = db.prepare(
    "SELECT key, value FROM settings WHERE key IN ('ytdlp_path', 'ffmpeg_path', 'streamlink_path')"
  ).all();
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const ytdlpPath     = m.ytdlp_path || "C:/yt-dlp/yt-dlp.exe";
  const ffmpegPath    = m.ffmpeg_path || "C:/ffmpeg/bin/ffmpeg.exe";
  const streamlinkPath = m.streamlink_path || "streamlink";

  const [ytdlp, ffmpeg, streamlink] = await Promise.all([
    checkTool(ytdlpPath, ["--version"]),
    checkTool(ffmpegPath, ["-version"]),
    checkTool(streamlinkPath, ["--version"]),
  ]);

  res.json({ ytdlp, ffmpeg, streamlink });
});

export default router;
