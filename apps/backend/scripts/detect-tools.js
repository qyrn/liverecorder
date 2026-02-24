import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, "../../../liverecorder.db");

if (!existsSync(dbPath)) process.exit(0);

const db = new Database(dbPath);

function whereTool(name) {
  const res = spawnSync("where", [name], { encoding: "utf-8" });
  if (res.status !== 0 || !res.stdout) return null;
  return res.stdout.trim().split(/\r?\n/)[0]?.trim() || null;
}

const tools = [
  { key: "ytdlp_path",  cmd: "yt-dlp" },
  { key: "ffmpeg_path", cmd: "ffmpeg" },
];

const get = db.prepare("SELECT value FROM settings WHERE key = ?");
const upd = db.prepare("UPDATE settings SET value = ? WHERE key = ?");

for (const { key, cmd } of tools) {
  const row = get.get(key);
  const current = row?.value;
  if (!current) continue;
  if (existsSync(current)) continue;
  const found = whereTool(cmd);
  if (found) {
    upd.run(found.replace(/\\/g, "/"), key);
    console.log(`[detect] ${key} => ${found}`);
  }
}

db.close();
