import React, { useState, useEffect, useCallback } from "react";
import { api } from "../api/client.js";

function formatSize(bytes) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDuration(sec) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

const statusColors = {
  recording: "text-red-400",
  completed: "text-green-400",
  failed: "text-yellow-400",
  cancelled: "text-zinc-500",
  pending: "text-zinc-400",
};

const platformColors = {
  twitch: "text-purple-400",
  youtube: "text-red-400",
  tiktok: "text-zinc-400",
};

export default function Recordings() {
  const [data, setData] = useState({ rows: [], total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api.recordings.list({
        page,
        limit: 50,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      setData(result);
    } catch {}
  }, [page, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Bibliothèque</h1>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-sm text-white focus:outline-none"
          >
            <option value="">Tous les statuts</option>
            <option value="recording">En cours</option>
            <option value="completed">Terminé</option>
            <option value="failed">Échoué</option>
            <option value="cancelled">Annulé</option>
          </select>
          <span className="text-sm text-zinc-500">{data.total} enregistrement(s)</span>
        </div>
      </div>

      {data.rows.length === 0 ? (
        <p className="text-center py-20 text-zinc-600">Aucun enregistrement.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 pr-4 font-medium">#</th>
                <th className="pb-2 pr-4 font-medium">Streamer</th>
                <th className="pb-2 pr-4 font-medium">Plateforme</th>
                <th className="pb-2 pr-4 font-medium">Titre</th>
                <th className="pb-2 pr-4 font-medium">Taille</th>
                <th className="pb-2 pr-4 font-medium">Durée</th>
                <th className="pb-2 pr-4 font-medium">Statut</th>
                <th className="pb-2 font-medium">Démarré</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                  <td className="py-2.5 pr-4 text-zinc-500">{r.id}</td>
                  <td className="py-2.5 pr-4 font-medium">{r.streamer_name ?? "Manuel"}</td>
                  <td className={`py-2.5 pr-4 ${platformColors[r.platform]}`}>{r.platform}</td>
                  <td className="py-2.5 pr-4 text-zinc-400 max-w-xs truncate">{r.stream_title ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-zinc-400">{formatSize(r.file_size_bytes)}</td>
                  <td className="py-2.5 pr-4 text-zinc-400">{formatDuration(r.duration_sec)}</td>
                  <td className={`py-2.5 pr-4 font-medium ${statusColors[r.status]}`}>{r.status}</td>
                  <td className="py-2.5 text-zinc-500">{r.started_at?.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.total > 50 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-sm transition-colors"
          >
            Précédent
          </button>
          <span className="px-3 py-1.5 text-sm text-zinc-500">Page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={data.rows.length < 50}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-sm transition-colors"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
