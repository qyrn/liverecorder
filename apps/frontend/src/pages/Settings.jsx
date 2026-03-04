import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { api } from "../api/client.js";
import { translations } from "../i18n.js";

const TOOLS = [
  { key: "ytdlp",  label: "yt-dlp" },
  { key: "ffmpeg", label: "ffmpeg" },
];

function getSections(t) {
  return [
    {
      label: t.sectionPaths,
      fields: [
        { key: "ytdlp_path",  label: "yt-dlp",  type: "text" },
        { key: "ffmpeg_path", label: "ffmpeg",   type: "text" },
      ],
    },
    {
      label: t.sectionDownload,
      fields: [
        { key: "output_path",    label: t.outputPath, type: "text" },
        { key: "quality_preset", label: t.qualityMax, type: "select", options: t.qualityOptions },
        { key: "max_concurrent", label: t.concurrent, type: "number", hint: t.hintConcurrent },
      ],
    },
    {
      label: t.sectionAdvanced,
      fields: [
        { key: "hls_concurrency",            label: t.hlsWorkers,     type: "number", hint: t.hintHls },
        { key: "ytdlp_concurrent_fragments", label: t.ytdlpFragments, type: "number", hint: t.hintFragments },
      ],
    },
  ];
}

export default function SettingsPanel({ onClose, lang }) {
  const t = translations[lang] ?? translations.fr;
  const sections = getSections(t);

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
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)",
        width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          position: "sticky", top: 0, background: "#0d0d0d", zIndex: 1,
        }}>
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.02em" }}>
            {t.settingsTitle}
          </span>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          {health && (
            <div className="card" style={{ padding: "12px 14px", marginBottom: 20 }}>
              <p className="section-label" style={{ marginBottom: 10 }}>{t.toolsStatus}</p>
              <div style={{ display: "flex", gap: 20 }}>
                {TOOLS.map(({ key, label }) => {
                  const ok = health[key]?.ok;
                  const dotColor = ok ? "#22c55e" : "#e63946";
                  const textColor = ok ? "#aaa" : "#444";
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: textColor, letterSpacing: "0.04em" }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {sections.map(({ label, fields }) => (
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
                {t.save}
              </button>
              {saved && <span style={{ fontSize: 10, color: "#22c55e", letterSpacing: "0.08em" }}>{t.saved}</span>}
              {error && <span style={{ fontSize: 10, color: "#e63946" }}>{error}</span>}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
