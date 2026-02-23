import { Router } from "express";
import { getDb } from "../db/client.js";

const router = Router();

router.get("/", (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const result = {};
  for (const { key, value } of rows) {
    result[key] = value;
  }
  res.json(result);
});

router.patch("/", (req, res) => {
  const db = getDb();
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );

  const update = db.transaction((entries) => {
    for (const [key, value] of entries) {
      upsert.run(key, String(value));
    }
  });

  update(Object.entries(req.body));

  const rows = db.prepare("SELECT key, value FROM settings").all();
  const result = {};
  for (const { key, value } of rows) {
    result[key] = value;
  }
  res.json(result);
});

export default router;
