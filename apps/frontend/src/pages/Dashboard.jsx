import React, { useState, useEffect, useCallback } from "react";
import { Square, Circle } from "lucide-react";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { api } from "../api/client.js";

const PLATFORM_COLORS = { twitch: "#9147ff", youtube: "#ff0000", tiktok: "#ff0050" };

function fmt_size(b) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

function fmt_dur(s) {
  if (!s) return "0:00:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function RecordingCard({ recording, onCancel }) {
  const [stopping, setStopping] = useState(false);
  const color = PLATFORM_COLORS[recording.platform] ?? "#555";

  async function handleStop() {
    setStopping(true);
    try { await onCancel(recording.id); } finally { setStopping(false); }
  }

  return (
    <div className="card card-rec sweep-in" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="rec-blink" style={{ width: 7, height: 7, borderRadius: "50%", background: "#e63946", display: "inline-block" }} />
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#aaa", letterSpacing: "0.04em" }}>
              {recording.streamer_name ?? "Manuel"}
            </span>
          </div>
          <span style={{ fontSize: 9, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {recording.platform}
          </span>
        </div>

        {recording.stream_title && (
          <p style={{ fontSize: 11, color: "#555", margin: "0 0 14px", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {recording.stream_title}
          </p>
        )}

        <div style={{ display: "flex", gap: 24, marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 9, color: "#2d2d2d", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 3px" }}>Taille</p>
            <p className="tabnum" style={{ fontSize: 15, color: "#efefef", margin: 0, fontWeight: 500, letterSpacing: "-0.01em" }}>
              {fmt_size(recording.file_size_bytes)}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 9, color: "#2d2d2d", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 3px" }}>Durée</p>
            <p className="tabnum" style={{ fontSize: 15, color: "#efefef", margin: 0, fontWeight: 500, letterSpacing: "-0.01em" }}>
              {fmt_dur(recording.duration_sec)}
            </p>
          </div>
        </div>

        <button className="btn-ghost" onClick={handleStop} disabled={stopping} style={{ width: "100%", justifyContent: "center" }}>
          <Square size={9} fill="currentColor" />
          {stopping ? "Arrêt..." : "Arrêter l'enregistrement"}
        </button>
      </div>
    </div>
  );
}

export default function Dashboard({ lastStarted }) {
  const [recordings, setRecordings] = useState([]);

  const load = useCallback(async () => {
    try { setRecordings(await api.recordings.active()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load, lastStarted]);

  const handleMessage = useCallback((msg) => {
    if (msg.event === "init") {
      setRecordings(msg.data.active ?? []);
    } else if (msg.event === "recording:started") {
      load();
    } else if (msg.event === "recording:progress") {
      setRecordings((prev) =>
        prev.map((r) =>
          r.id === msg.data.recordingId
            ? { ...r, file_size_bytes: msg.data.file_size_bytes, duration_sec: msg.data.duration_sec }
            : r
        )
      );
    } else if (msg.event === "recording:ended") {
      setRecordings((prev) => prev.filter((r) => r.id !== msg.data.recordingId));
    }
  }, [load]);

  useWebSocket(handleMessage);

  async function handleCancel(id) {
    try { await api.recordings.cancel(id); } catch {}
  }

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 32 }}>
        <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
          Dashboard
        </h1>
        {recordings.length > 0 && (
          <span style={{ fontSize: 10, color: "#e63946", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {recordings.length} actif{recordings.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {recordings.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 280, gap: 10 }}>
          <Circle size={28} strokeWidth={1} style={{ color: "#1a1a1a" }} />
          <p style={{ fontSize: 11, color: "#2d2d2d", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
            Aucun enregistrement en cours
          </p>
          <p style={{ fontSize: 11, color: "#222", margin: 0 }}>
            Colle une URL dans la sidebar ou ajoute des streamers.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {recordings.map((r) => (
            <RecordingCard key={r.id} recording={r} onCancel={handleCancel} />
          ))}
        </div>
      )}
    </div>
  );
}
