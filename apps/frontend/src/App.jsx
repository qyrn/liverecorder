import React, { useState, useCallback, useEffect } from "react";
import { BrowserRouter, NavLink, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LayoutGrid, Users, Film, Settings as SettingsIcon, Circle, Loader } from "lucide-react";
import Dashboard from "./pages/Dashboard.jsx";
import Streamers from "./pages/Streamers.jsx";
import Recordings from "./pages/Recordings.jsx";
import Settings from "./pages/Settings.jsx";
import { api } from "./api/client.js";
import { useWebSocket } from "./hooks/useWebSocket.js";

const NAV = [
  { to: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { to: "/streamers", icon: Users, label: "Streamers" },
  { to: "/recordings", icon: Film, label: "Recordings" },
  { to: "/settings", icon: SettingsIcon, label: "Settings" },
];

function Sidebar({ activeCount, onStarted }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleStart(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const platform = url.includes("twitch.tv")
        ? "twitch"
        : url.includes("tiktok.com")
        ? "tiktok"
        : "youtube";
      const result = await api.recordings.start({ url: url.trim(), platform, trigger: "manual" });
      setUrl("");
      if (onStarted) onStarted(result.recordingId);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: "#0a0a0a",
        borderRight: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 10,
      }}
    >
      <div style={{ padding: "24px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {activeCount > 0 && (
            <span
              className="rec-blink"
              style={{ width: 7, height: 7, borderRadius: "50%", background: "#e63946", display: "inline-block", flexShrink: 0 }}
            />
          )}
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: "0.05em", color: "#efefef" }}>
            LIVERECORDER
          </span>
        </div>
        {activeCount > 0 ? (
          <p style={{ fontSize: 10, color: "#e63946", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0, paddingLeft: 15 }}>
            {activeCount} recording{activeCount > 1 ? "s" : ""}
          </p>
        ) : (
          <p style={{ fontSize: 10, color: "#333", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
            idle
          </p>
        )}
      </div>

      <div className="divider" />

      <nav style={{ padding: "8px 0", flex: 1 }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
          >
            <Icon size={13} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="divider" />

      <div style={{ padding: "16px 20px 20px" }}>
        <p className="section-label" style={{ marginBottom: 8 }}>Enregistrer une URL</p>
        <form onSubmit={handleStart} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            className="input-field"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="twitch.tv/…  youtube.com/…"
            style={{ fontSize: 11 }}
          />
          <button
            className="btn-rec"
            type="submit"
            disabled={loading || !url.trim()}
            style={{ justifyContent: "center" }}
          >
            {loading ? <Loader size={11} className="animate-spin" /> : <Circle size={10} fill="currentColor" />}
            {loading ? "Lancement..." : "Enregistrer"}
          </button>
          {error && (
            <p style={{ fontSize: 10, color: "#e63946", margin: 0, lineHeight: 1.4 }}>{error}</p>
          )}
        </form>
      </div>
    </aside>
  );
}

function PageWrapper({ children }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="sweep-in" style={{ height: "100%" }}>
      {children}
    </div>
  );
}

export default function App() {
  const [activeCount, setActiveCount] = useState(0);
  const [lastStarted, setLastStarted] = useState(null);

  const handleMessage = useCallback((msg) => {
    if (msg.event === "init") {
      setActiveCount((msg.data.active ?? []).length);
    } else if (msg.event === "recording:started") {
      setActiveCount((n) => n + 1);
    } else if (msg.event === "recording:ended") {
      setActiveCount((n) => Math.max(0, n - 1));
    }
  }, []);

  useWebSocket(handleMessage);

  useEffect(() => {
    api.recordings.active().then((rows) => setActiveCount(rows.length)).catch(() => {});
  }, []);

  const handleStarted = useCallback((id) => {
    setLastStarted(id);
    setActiveCount((n) => n + 1);
  }, []);

  return (
    <BrowserRouter>
      <div className="noise-overlay" />
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <Sidebar activeCount={activeCount} onStarted={handleStarted} />
        <main
          style={{
            marginLeft: 220,
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            background: "#080808",
          }}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<PageWrapper><Dashboard lastStarted={lastStarted} /></PageWrapper>} />
            <Route path="/streamers" element={<PageWrapper><Streamers /></PageWrapper>} />
            <Route path="/recordings" element={<PageWrapper><Recordings /></PageWrapper>} />
            <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
