import { getDb } from "./client.js";

export function runMigrations() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      stream_title TEXT,
      file_path TEXT,
      file_size_bytes INTEGER DEFAULT 0,
      duration_sec INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','recording','completed','failed','cancelled')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const defaults = [
    ["output_path", "./recordings"],
    ["ytdlp_path", "C:/yt-dlp/yt-dlp.exe"],
    ["ffmpeg_path", "C:/ffmpeg/bin/ffmpeg.exe"],
    ["streamlink_path", "streamlink"],
    ["cookies_file", ""],
    ["quality_preset", "source"],
    ["max_concurrent", "3"],
    ["hls_concurrency", "16"],
    ["ytdlp_concurrent_fragments", "4"],
  ];

  const upsert = db.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
  );
  for (const [key, value] of defaults) {
    upsert.run(key, value);
  }
}
