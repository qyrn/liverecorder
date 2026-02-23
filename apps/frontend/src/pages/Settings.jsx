import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { api } from "../api/client.js";

const SECTIONS = [
  {
    label: "Clés API",
    fields: [
      { key: "twitch_client_id",     label: "Twitch Client ID",     type: "text" },
      { key: "twitch_client_secret", label: "Twitch Client Secret", type: "password" },
      { key: "youtube_api_key",      label: "YouTube API Key",       type: "password" },
    ],
  },
  {
    label: "Chemins outils",
    fields: [
      { key: "ytdlp_path",      label: "yt-dlp",      type: "text" },
      { key: "ffmpeg_path",     label: "ffmpeg",      type: "text" },
      { key: "streamlink_path", label: "streamlink",  type: "text" },
      { key: "cookies_file",    label: "Cookies Twitch (.txt)", type: "text" },
    ],
  },
  {
    label: "Enregistrement",
    fields: [
      { key: "output_path",    label: "Dossier de sortie",       type: "text" },
      { key: "max_concurrent", label: "Enregistrements simultanés", type: "number" },
    ],
  },
  {
    label: "Intervalles de polling (secondes)",
    fields: [
      { key: "poll_interval_twitch",  label: "Twitch",  type: "number" },
      { key: "poll_interval_youtube", label: "YouTube", type: "number" },
      { key: "poll_interval_tiktok",  label: "TikTok",  type: "number" },
    ],
  },
];

const TOOLS = [
  { key: "ytdlp",     label: "yt-dlp" },
  { key: "ffmpeg",    label: "ffmpeg" },
  { key: "streamlink",label: "streamlink" },
  { key: "twitch",    label: "Twitch API", isConfigured: true },
  { key: "youtube",   label: "YouTube API", isConfigured: true },
];

export default function Settings() {
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
    <div style={{ padding: "32px 36px", maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
          Settings
        </h1>
        <p style={{ fontSize: 11, color: "#333", margin: 0 }}>
          Configuration des outils et des clés API
        </p>
      </div>

      {health && (
        <div className="card" style={{ padding: "14px 16px", marginBottom: 24 }}>
          <p className="section-label" style={{ marginBottom: 12 }}>État des outils</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {TOOLS.map(({ key, label, isConfigured }) => {
              const ok = isConfigured ? health[key]?.configured : health[key]?.ok;
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
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

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {SECTIONS.map(({ label, fields }) => (
          <div key={label} className="card" style={{ padding: "16px" }}>
            <p className="section-label" style={{ marginBottom: 14 }}>{label}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {fields.map(({ key, label: fieldLabel, type }) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <label style={{ width: 200, fontSize: 11, color: "#555", flexShrink: 0 }}>{fieldLabel}</label>
                  <input
                    className="input-field"
                    type={type}
                    value={values[key] ?? ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    style={{ fontSize: 11 }}
                  />
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
  );
}
