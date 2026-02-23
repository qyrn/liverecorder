import { Router } from "express";
import { getDb } from "../db/client.js";

const router = Router();

router.get("/", (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM streamers ORDER BY created_at DESC").all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const { name, platform, identifier, enabled = 1 } = req.body;
  if (!name || !platform || !identifier) {
    return res.status(400).json({ error: "name, platform, identifier required" });
  }
  if (!["twitch", "youtube", "tiktok"].includes(platform)) {
    return res.status(400).json({ error: "invalid platform" });
  }
  try {
    const db = getDb();
    const result = db
      .prepare(
        "INSERT INTO streamers (name, platform, identifier, enabled) VALUES (?, ?, ?, ?)"
      )
      .run(name, platform, identifier, enabled ? 1 : 0);
    const row = db.prepare("SELECT * FROM streamers WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "streamer already exists for this platform" });
    }
    throw err;
  }
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM streamers WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

router.patch("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM streamers WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });

  const { name, platform, identifier, enabled } = req.body;
  const updated = {
    name: name ?? row.name,
    platform: platform ?? row.platform,
    identifier: identifier ?? row.identifier,
    enabled: enabled !== undefined ? (enabled ? 1 : 0) : row.enabled,
  };

  db.prepare(
    "UPDATE streamers SET name=?, platform=?, identifier=?, enabled=? WHERE id=?"
  ).run(updated.name, updated.platform, updated.identifier, updated.enabled, req.params.id);

  res.json(db.prepare("SELECT * FROM streamers WHERE id = ?").get(req.params.id));
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM streamers WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  db.prepare("DELETE FROM streamers WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

export default router;
