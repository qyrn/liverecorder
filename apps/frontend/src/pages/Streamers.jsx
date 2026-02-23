import React, { useState, useEffect, useCallback } from "react";
import { api } from "../api/client.js";

const PLATFORMS = ["twitch", "youtube", "tiktok"];

const platformColors = {
  twitch: "text-purple-400",
  youtube: "text-red-400",
  tiktok: "text-zinc-400",
};

function StreamerRow({ streamer, onToggle, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(streamer.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{streamer.name}</span>
          <span className={`text-xs ${platformColors[streamer.platform]}`}>{streamer.platform}</span>
        </div>
        <p className="text-sm text-zinc-500 truncate">{streamer.identifier}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={!!streamer.enabled}
          onChange={() => onToggle(streamer.id, !streamer.enabled)}
        />
        <div className="w-9 h-5 bg-zinc-700 peer-checked:bg-red-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
      </label>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="px-2 py-1 rounded text-xs text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors disabled:opacity-40"
      >
        {deleting ? "..." : "Supprimer"}
      </button>
    </div>
  );
}

function AddStreamerForm({ onAdded }) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("twitch");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !identifier.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onAdded({ name: name.trim(), platform, identifier: identifier.trim() });
      setName("");
      setIdentifier("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
      <div className="flex-1">
        <label className="block text-xs text-zinc-500 mb-1">Nom affiché</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="xQc"
          className="w-full px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Plateforme</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-sm text-white focus:outline-none focus:border-zinc-500"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label className="block text-xs text-zinc-500 mb-1">Identifiant</label>
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={platform === "twitch" ? "xqc" : platform === "youtube" ? "UCxxxxxx" : "@username"}
          className="w-full px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !name.trim() || !identifier.trim()}
        className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm font-medium text-white transition-colors"
      >
        {loading ? "..." : "Ajouter"}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </form>
  );
}

export default function Streamers() {
  const [streamers, setStreamers] = useState([]);

  const load = useCallback(async () => {
    try {
      const rows = await api.streamers.list();
      setStreamers(rows);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(data) {
    await api.streamers.create(data);
    await load();
  }

  async function handleToggle(id, enabled) {
    await api.streamers.update(id, { enabled });
    setStreamers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: enabled ? 1 : 0 } : s))
    );
  }

  async function handleDelete(id) {
    await api.streamers.remove(id);
    setStreamers((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Streamers surveillés</h1>
      <div className="flex flex-col gap-3">
        <AddStreamerForm onAdded={handleAdd} />
        {streamers.length === 0 ? (
          <p className="text-center py-12 text-zinc-600">Aucun streamer ajouté.</p>
        ) : (
          streamers.map((s) => (
            <StreamerRow key={s.id} streamer={s} onToggle={handleToggle} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}
