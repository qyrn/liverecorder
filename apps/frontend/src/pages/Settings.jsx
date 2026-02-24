import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { api } from "../api/client.js";

const SECTIONS = [
  {
    label: "Chemins outils",
    fields: [
      { key: "ytdlp_path",      label: "yt-dlp",      type: "text" },
      { key: "ffmpeg_path",     label: "ffmpeg",      type: "text" },
      { key: "streamlink_path", label: "streamlink",  type: "text" },
      {
        key: "cookies_file",
        label: "Fichier cookies (.txt)",
        type: "text",
        hint: "Sub-only Twitch, membres YouTube, contenu âge restreint. Exporte via « Get cookies.txt LOCALLY ».",
      },
    ],
  },
  {
    label: "Téléchargement",
    fields: [
      { key: "output_path", label: "Dossier de sortie", type: "text" },
      {
        key: "quality_preset",
        label: "Qualité max",
        type: "select",
        options: [
          { value: "source", label: "Source — meilleure qualité" },
          { value: "1080p",  label: "1080p — ~30-40% plus petit" },
          { value: "720p",   label: "720p — ~60% plus petit" },
          { value: "480p",   label: "480p — ~80% plus petit" },
        ],
      },
      {
        key: "max_concurrent",
        label: "Téléchargements simultanés",
        type: "number",
        hint: "Nombre maximum de téléchargements en parallèle.",
      },
    ],
  },
  {
    label: "Avancé",
    fields: [
      {
        key: "hls_concurrency",
        label: "Workers HLS",
        type: "number",
        hint: "Segments téléchargés en parallèle pour les VODs Twitch (bypass CloudFront). Défaut : 16.",
      },
      {
        key: "ytdlp_concurrent_fragments",
        label: "Fragments yt-dlp",
        type: "number",
        hint: "Fragments simultanés pour yt-dlp (YouTube, TikTok, etc.). Défaut : 4.",
      },
    ],
  },
];

const TOOLS = [
  { key: "ytdlp",      label: "yt-dlp" },
  { key: "ffmpeg",     label: "ffmpeg" },
  { key: "streamlink", label: "streamlink" },
];

export default function SettingsPanel({ onClose }) {
  const [values, setValues] = useState({});
  const [health, setHealth] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.settings.get().then(setValues).catch(() => {});
    api.health().then(setHealth).catch(() => {});
  }, []);

  function handleChange(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.settings.update(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#0d0d0d",
          border: "1px solid rgba(255,255,255,0.08)",
          width: "100%",
          maxWidth: 560,
          maxHeight: "85vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          position: "sticky",
          top: 0,
          background: "#0d0d0d",
          zIndex: 1,
        }}>
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.02em" }}>
            Paramètres
          </span>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#555",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          {health && (
            <div className="card" style={{ padding: "12px 14px", marginBottom: 20 }}>
              <p className="section-label" style={{ marginBottom: 10 }}>État des outils</p>
              <div style={{ display: "flex", gap: 20 }}>
                {TOOLS.map(({ key, label }) => {
                  const ok = health[key]?.ok;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: ok ? "#22c55e" : "#e63946",
                        display: "inline-block",
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 10, color: ok ? "#aaa" : "#555", letterSpacing: "0.04em" }}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {SECTIONS.map(({ label, fields }) => (
              <div key={label} className="card" style={{ padding: "14px" }}>
                <p className="section-label" style={{ marginBottom: 12 }}>{label}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {fields.map(({ key, label: fieldLabel, type, options, hint }) => (
                    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <label style={{ width: 180, fontSize: 11, color: "#555", flexShrink: 0 }}>{fieldLabel}</label>
                        {type === "select" ? (
                          <select
                            className="input-field"
                            value={values[key] ?? ""}
                            onChange={(e) => handleChange(key, e.target.value)}
                            style={{ fontSize: 11 }}
                          >
                            {options.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="input-field"
                            type={type}
                            value={values[key] ?? ""}
                            onChange={(e) => handleChange(key, e.target.value)}
                            style={{ fontSize: 11 }}
                          />
                        )}
                      </div>
                      {hint && (
                        <p style={{ margin: "0 0 0 192px", fontSize: 10, color: "#333", lineHeight: 1.4 }}>{hint}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button className="btn-rec" type="submit">
                <Save size={11} />
                Sauvegarder
              </button>
              {saved && <span style={{ fontSize: 10, color: "#22c55e", letterSpacing: "0.08em" }}>Sauvegardé.</span>}
              {error && <span style={{ fontSize: 10, color: "#e63946" }}>{error}</span>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
