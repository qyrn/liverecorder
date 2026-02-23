import { getDb } from "./client.js";

export function runMigrations() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS streamers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('twitch', 'youtube', 'tiktok')),
      identifier TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(platform, identifier)
    );

    CREATE TABLE IF NOT EXISTS recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      streamer_id INTEGER REFERENCES streamers(id) ON DELETE SET NULL,
      platform TEXT NOT NULL,
      stream_title TEXT,
      file_path TEXT,
      file_size_bytes INTEGER DEFAULT 0,
      duration_sec INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','recording','completed','failed','cancelled')),
      trigger TEXT NOT NULL DEFAULT 'auto' CHECK(trigger IN ('auto','manual')),
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
    ["poll_interval_twitch", "60"],
    ["poll_interval_youtube", "300"],
    ["poll_interval_tiktok", "120"],
    ["max_concurrent", "3"],
    ["ytdlp_path", "C:/yt-dlp/yt-dlp.exe"],
    ["ffmpeg_path", "C:/ffmpeg/bin/ffmpeg.exe"],
    ["streamlink_path", "streamlink"],
    ["twitch_client_id", ""],
    ["twitch_client_secret", ""],
    ["youtube_api_key", ""],
    ["cookies_file", ""],
  ];

  const upsert = db.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`
  );
  for (const [key, value] of defaults) {
    upsert.run(key, value);
  }
}
