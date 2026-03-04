import React, { useState, useCallback, useEffect, useRef } from "react";
import { Settings as SettingsIcon, Download, Square, ChevronDown, ChevronLeft, ChevronRight, Loader } from "lucide-react";
import SettingsPanel from "./pages/Settings.jsx";
import { api } from "./api/client.js";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { translations, getLang, setLang } from "./i18n.js";

const QUALITY_OPTIONS = [
  { value: "source", label: "Source" },
  { value: "1080p",  label: "1080p" },
  { value: "720p",   label: "720p" },
  { value: "480p",   label: "480p" },
];

const PLATFORM_COLORS = { twitch: "#9147ff", youtube: "#ff0000", tiktok: "#ff0050" };

function fmtSize(b) {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

function fmtDur(s) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

function fmtDate(iso, locale) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function fmtEta(startedAt, percent) {
  if (!percent || percent <= 0) return null;
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  const total = elapsed / (percent / 100);
  const remaining = Math.max(0, total - elapsed);
  if (remaining < 5) return null;
  if (remaining >= 3600) return `${Math.floor(remaining / 3600)}h ${String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}m`;
  if (remaining >= 60) return `${Math.floor(remaining / 60)}m ${String(Math.floor(remaining % 60)).padStart(2, "0")}s`;
  return `${Math.floor(remaining)}s`;
}

function ActiveRow({ rec, onCancel, t }) {
  const [stopping, setStopping] = useState(false);
  const pc = PLATFORM_COLORS[rec.platform] ?? "#555";
  const percent = rec.percent ?? null;
  const eta = percent != null ? fmtEta(rec.started_at, percent) : null;

  async function handleCancel() {
    setStopping(true);
    try { await onCancel(rec.id); } finally { setStopping(false); }
  }

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span className="rec-blink" style={{ width: 6, height: 6, borderRadius: "50%", background: "#e63946", flexShrink: 0 }} />
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: pc, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {rec.stream_title ?? rec.platform}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {percent != null && (
              <span className="tabnum" style={{ fontSize: 11, color: "#efefef" }}>{percent}%</span>
            )}
            {eta && (
              <span className="tabnum" style={{ fontSize: 10, color: "#555" }}>ETA {eta}</span>
            )}
            <span className="tabnum" style={{ fontSize: 11, color: "#666" }}>{fmtSize(rec.file_size_bytes)}</span>
            <button
              className="btn-ghost"
              onClick={handleCancel}
              disabled={stopping}
              style={{ padding: "4px 10px" }}
            >
              {stopping ? <Loader size={9} className="animate-spin" /> : <Square size={9} fill="currentColor" />}
              {stopping ? t.stopping : t.cancel}
            </button>
          </div>
        </div>

        <div style={{ height: 2, background: "rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
          {percent != null ? (
            <div style={{
              position: "absolute", left: 0, top: 0, height: "100%",
              width: `${percent}%`, background: "#e63946", transition: "width 0.5s ease",
            }} />
          ) : (
            <div style={{
              position: "absolute", top: 0, height: "100%", width: "30%",
              background: "linear-gradient(90deg, transparent, #e63946, transparent)",
              animation: "progress-indeterminate 1.5s linear infinite",
            }} />
          )}
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
          <span style={{ fontSize: 10, color: "#333" }}>{rec.platform}</span>
          <span className="tabnum" style={{ fontSize: 10, color: "#333" }}>{fmtDur(rec.duration_sec)}</span>
          <span style={{ fontSize: 10, color: "#333" }}>{fmtDate(rec.started_at, t.dateLocale)}</span>
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ rec, t }) {
  const st = { color: "#555", label: t.status.pending, ...(t.status[rec.status] ? { label: t.status[rec.status] } : {}) };
  const stColor = rec.status === "recording" ? "#e63946" : rec.status === "completed" ? "#22c55e" : rec.status === "failed" ? "#f59e0b" : rec.status === "cancelled" ? "#3d3d3d" : "#555";
  const pc = PLATFORM_COLORS[rec.platform] ?? "#555";

  return (
    <div
      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", padding: "11px 20px" }}
      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.015)"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: pc, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>
            {rec.stream_title ?? rec.platform}
          </span>
          <span style={{ fontSize: 10, color: "#333" }}>— {fmtDate(rec.started_at, t.dateLocale)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <span className="tabnum" style={{ fontSize: 11, color: "#555" }}>{fmtSize(rec.file_size_bytes)}</span>
          <span style={{ fontSize: 9, letterSpacing: "0.1em", padding: "2px 7px", color: stColor, background: `${stColor}18` }}>
            {t.status[rec.status] ?? t.status.pending}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [lang, setLangState] = useState(getLang);
  const t = translations[lang];

  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState("source");
  const [loading, setLoading] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState({ rows: [], total: 0 });
  const [page, setPage] = useState(1);

  function toggleLang() {
    const next = lang === "fr" ? "en" : "fr";
    setLang(next);
    setLangState(next);
  }

  const loadHistory = useCallback(async (p = 1) => {
    try {
      const result = await api.recordings.list({ page: p, limit: 20, status: "completed,failed,cancelled" });
      setHistory(result);
    } catch {}
  }, []);

  const handleMessage = useCallback((msg) => {
    if (msg.event === "init") {
      setActive(msg.data.active ?? []);
    } else if (msg.event === "recording:started") {
      api.recordings.active().then(setActive).catch(() => {});
    } else if (msg.event === "recording:progress") {
      setActive((prev) =>
        prev.map((r) =>
          r.id === msg.data.recordingId
            ? { ...r, file_size_bytes: msg.data.file_size_bytes ?? r.file_size_bytes, duration_sec: msg.data.duration_sec ?? r.duration_sec, percent: msg.data.percent ?? r.percent }
            : r
        )
      );
    } else if (msg.event === "recording:ended") {
      setActive((prev) => prev.filter((r) => r.id !== msg.data.recordingId));
      loadHistory(1);
      setPage(1);
    }
  }, [loadHistory]);

  useWebSocket(handleMessage);

  useEffect(() => {
    api.recordings.active().then(setActive).catch(() => {});
    loadHistory(1);
  }, [loadHistory]);

  async function handleDownload(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setUrlError(null);
    try {
      await api.recordings.start({ url: trimmed, qualityPreset: quality });
      setUrl("");
    } catch (err) {
      setUrlError(err.message);
      setTimeout(() => setUrlError(null), 5000);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id) {
    try { await api.recordings.cancel(id); } catch {}
  }

  const totalActive = active.length;

  return (
    <>
      <div className="noise-overlay" />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} lang={lang} />}

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {totalActive > 0 && (
              <span className="rec-blink" style={{ width: 7, height: 7, borderRadius: "50%", background: "#e63946", display: "inline-block" }} />
            )}
            <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.06em", color: "#efefef" }}>
              LIVERECORDER
            </span>
            {totalActive > 0 && (
              <span style={{ fontSize: 10, color: "#e63946", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {t.activeCount(totalActive)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={toggleLang}
              style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                color: "#555", cursor: "pointer", padding: "6px 10px",
                fontSize: 9, letterSpacing: "0.08em", fontFamily: "JetBrains Mono, monospace",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#efefef"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              {lang === "fr" ? "EN" : "FR"}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                color: "#555", cursor: "pointer", padding: "6px 12px",
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#efefef"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <SettingsIcon size={11} />
              {t.settings}
            </button>
          </div>
        </header>

        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "48px 24px 40px", borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}>
          <form onSubmit={handleDownload} style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: "100%", display: "flex", gap: 0 }}>
              <input
                className="input-field"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.twitch.tv/videos/…  —  youtube.com/…  —  tiktok.com/…"
                style={{ fontSize: 12, flex: 1, borderRight: "none" }}
                autoFocus
              />
              <div style={{ position: "relative", flexShrink: 0 }}>
                <select
                  className="input-field"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  style={{ fontSize: 11, width: 100, paddingRight: 28, appearance: "none", borderLeft: "none", cursor: "pointer" }}
                >
                  {QUALITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={11} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#555" }} />
              </div>
            </div>

            <button
              className="btn-rec"
              type="submit"
              disabled={loading || !url.trim()}
              style={{ padding: "10px 32px", fontSize: 11 }}
            >
              {loading ? <Loader size={11} className="animate-spin" /> : <Download size={11} />}
              {loading ? t.starting : t.download}
            </button>

            {urlError && (
              <p style={{ fontSize: 11, color: "#e63946", margin: 0, letterSpacing: "0.02em" }}>{urlError}</p>
            )}
          </form>
        </div>

        <div style={{ flex: 1, maxWidth: 800, width: "100%", margin: "0 auto", padding: "0 0 40px" }}>
          {active.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <p className="section-label" style={{ padding: "0 20px", marginBottom: 8 }}>{t.activeSection}</p>
              <div className="card" style={{ padding: 0 }}>
                {active.map((rec) => (
                  <ActiveRow key={rec.id} rec={rec} onCancel={handleCancel} t={t} />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: active.length > 0 ? 28 : 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: 8 }}>
              <p className="section-label" style={{ margin: 0 }}>{t.historySection}</p>
              {history.total > 0 && (
                <span style={{ fontSize: 10, color: "#333" }}>{t.totalDownloads(history.total)}</span>
              )}
            </div>

            {history.rows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ fontSize: 11, color: "#2d2d2d", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
                  {t.noDownloads}
                </p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {history.rows.map((r) => (
                  <HistoryRow key={r.id} rec={r} t={t} />
                ))}
              </div>
            )}

            {history.total > 20 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 }}>
                <button
                  className="btn-ghost"
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); loadHistory(Math.max(1, page - 1)); }}
                  disabled={page === 1}
                >
                  <ChevronLeft size={12} />
                </button>
                <span style={{ fontSize: 11, color: "#444" }}>{t.page(page)}</span>
                <button
                  className="btn-ghost"
                  onClick={() => { setPage((p) => p + 1); loadHistory(page + 1); }}
                  disabled={history.rows.length < 20}
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
