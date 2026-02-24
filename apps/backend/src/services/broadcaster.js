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

export function broadcastRecordingProgress(recordingId, progress) {
  broadcast("recording:progress", { recordingId, ...progress });
}

export function broadcastRecordingEnded(recordingId, finalData) {
  broadcast("recording:ended", { recordingId, ...finalData });
}

export function sendInit(ws) {
  const db = getDb();
  const active = db
    .prepare("SELECT * FROM recordings WHERE status = 'recording'")
    .all();
  ws.send(JSON.stringify({ event: "init", data: { active } }));
}
