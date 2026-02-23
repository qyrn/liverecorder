import React, { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { api } from "../api/client.js";

function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function PlatformBadge({ platform }) {
  const colors = {
    twitch: "bg-purple-600",
    youtube: "bg-red-600",
    tiktok: "bg-zinc-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[platform] ?? "bg-zinc-600"}`}>
      {platform}
    </span>
  );
}

function RecordingCard({ recording, onCancel }) {
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await onCancel(recording.id);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <PlatformBadge platform={recording.platform} />
          <span className="font-medium truncate">{recording.streamer_name ?? "Manuel"}</span>
        </div>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 shrink-0 transition-colors disabled:opacity-40"
        >
          {cancelling ? "..." : "Arrêter"}
        </button>
      </div>
      {recording.stream_title && (
        <p className="text-sm text-zinc-400 truncate">{recording.stream_title}</p>
      )}
      <div className="flex gap-4 text-sm text-zinc-400">
        <span>{formatSize(recording.file_size_bytes ?? 0)}</span>
        <span>{formatDuration(recording.duration_sec ?? 0)}</span>
      </div>
    </div>
  );
}

export default function Dashboard({ lastStarted }) {
  const [recordings, setRecordings] = useState([]);

  const load = useCallback(async () => {
    try {
      const rows = await api.recordings.active();
      setRecordings(rows);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load, lastStarted]);

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
    try {
      await api.recordings.cancel(id);
    } catch {}
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Enregistrements actifs</h1>
        <span className="text-sm text-zinc-500">{recordings.length} en cours</span>
      </div>
      {recordings.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          Aucun enregistrement en cours.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recordings.map((r) => (
            <RecordingCard key={r.id} recording={r} onCancel={handleCancel} />
          ))}
        </div>
      )}
    </div>
  );
}
