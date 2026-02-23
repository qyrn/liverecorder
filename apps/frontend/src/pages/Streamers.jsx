import React, { useState, useEffect, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../api/client.js";

const PLATFORMS = ["twitch", "youtube", "tiktok"];
const PLATFORM_COLORS = { twitch: "#9147ff", youtube: "#ff0000", tiktok: "#ff0050" };
const PLATFORM_HINTS = {
  twitch: "Login Twitch (ex: xqc)",
  youtube: "Channel ID YouTube (ex: UCxxxxxx)",
  tiktok: "Username TikTok (ex: @nom)",
};

function StreamerRow({ streamer, onToggle, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const color = PLATFORM_COLORS[streamer.platform] ?? "#555";

  async function handleDelete() {
    setDeleting(true);
    try { await onDelete(streamer.id); } finally { setDeleting(false); }
  }

  return (
    <div
      className="sweep-in"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: "#ddd", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {streamer.name}
        </p>
        <p style={{ fontSize: 10, color: "#444", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {streamer.identifier}
        </p>
      </div>

      <span style={{ fontSize: 9, color: "#333", letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0 }}>
        {streamer.platform}
      </span>

      <div
        className={`toggle ${streamer.enabled ? "on" : ""}`}
        onClick={() => onToggle(streamer.id, !streamer.enabled)}
        title={streamer.enabled ? "Désactiver" : "Activer"}
      />

      <button
        className="btn-ghost"
        onClick={handleDelete}
        disabled={deleting}
        style={{ padding: "5px 8px", border: "none" }}
        title="Supprimer"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function AddForm({ onAdded }) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("twitch");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    <form onSubmit={handleSubmit} className="card" style={{ padding: 16, marginBottom: 2 }}>
      <p className="section-label" style={{ marginBottom: 12 }}>Ajouter un streamer</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "end" }}>
        <div>
          <p style={{ fontSize: 9, color: "#3d3d3d", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 5px" }}>Nom affiché</p>
          <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="xQc" />
        </div>
        <div>
          <p style={{ fontSize: 9, color: "#3d3d3d", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 5px" }}>Plateforme</p>
          <select className="input-field" style={{ width: "auto" }} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize: 9, color: "#3d3d3d", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 5px" }}>Identifiant</p>
          <input className="input-field" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={PLATFORM_HINTS[platform]} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <button className="btn-rec" type="submit" disabled={loading || !name.trim() || !identifier.trim()}>
          <Plus size={11} />
          {loading ? "Ajout..." : "Ajouter"}
        </button>
        {error && <span style={{ fontSize: 10, color: "#e63946" }}>{error}</span>}
      </div>
    </form>
  );
}

export default function Streamers() {
  const [streamers, setStreamers] = useState([]);

  const load = useCallback(async () => {
    try { setStreamers(await api.streamers.list()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(data) {
    await api.streamers.create(data);
    await load();
  }

  async function handleToggle(id, enabled) {
    await api.streamers.update(id, { enabled });
    setStreamers((prev) => prev.map((s) => s.id === id ? { ...s, enabled: enabled ? 1 : 0 } : s));
  }

  async function handleDelete(id) {
    await api.streamers.remove(id);
    setStreamers((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
          Streamers
        </h1>
        <p style={{ fontSize: 11, color: "#333", margin: 0 }}>
          {streamers.filter((s) => s.enabled).length} surveillé{streamers.filter((s) => s.enabled).length !== 1 ? "s" : ""}
          {streamers.length > 0 ? ` / ${streamers.length} total` : ""}
        </p>
      </div>

      <AddForm onAdded={handleAdd} />

      {streamers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <p style={{ fontSize: 11, color: "#2d2d2d", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Aucun streamer configuré
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, marginTop: 2 }}>
          {streamers.map((s) => (
            <StreamerRow key={s.id} streamer={s} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
