import { Router } from "express";
import { getDb } from "../db/client.js";
import { startDownload, stopDownload } from "../services/recorder.js";

const router = Router();

router.get("/", (req, res) => {
  const db = getDb();
  const { status, platform, page = 1, limit = 50 } = req.query;
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (platform) {
    conditions.push("platform = ?");
    params.push(platform);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const rows = db
    .prepare(
      `SELECT * FROM recordings
       ${where}
       ORDER BY started_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, parseInt(limit), offset);

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM recordings ${where}`)
    .get(...params).count;

  res.json({ rows, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get("/active", (req, res) => {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM recordings WHERE status = 'recording' ORDER BY started_at DESC")
    .all();
  res.json(rows);
});

router.post("/start", async (req, res) => {
  const { url, qualityPreset } = req.body;
  if (!url) {
    return res.status(400).json({ error: "url required" });
  }
  try {
    const recordingId = await startDownload({ url: url.trim(), qualityPreset: qualityPreset ?? null });
    res.status(201).json({ recordingId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM recordings WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

router.post("/:id/cancel", async (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM recordings WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  if (row.status !== "recording") {
    return res.status(400).json({ error: "recording is not active" });
  }
  const stopped = await stopDownload(parseInt(req.params.id));
  if (!stopped) {
    return res.status(400).json({ error: "process not found in active map" });
  }
  res.json({ message: "cancelled", id: req.params.id });
});

export default router;
