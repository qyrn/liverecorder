import { getDb } from "../db/client.js";

let wss = null;

export function setBroadcasterWss(server) {
  wss = server;
}

function broadcast(event, data) {
  if (!wss) return;
  const msg = JSON.stringify({ event, data });
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

export function broadcastRecordingStarted(recordingId, meta) {
  broadcast("recording:started", { recordingId, ...meta });
}

export function broadcastRecordingProgress(recordingId, progress) {
  broadcast("recording:progress", { recordingId, ...progress });
}

export function broadcastRecordingEnded(recordingId, finalData) {
  broadcast("recording:ended", { recordingId, ...finalData });
}

export function sendInit(ws) {
  const db = getDb();
  const active = db
    .prepare(
      `SELECT r.*, s.name as streamer_name
       FROM recordings r
       LEFT JOIN streamers s ON r.streamer_id = s.id
       WHERE r.status = 'recording'`
    )
    .all();
  ws.send(JSON.stringify({ event: "init", data: { active } }));
}
