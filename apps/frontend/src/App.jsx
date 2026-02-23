import React, { useState, useCallback } from "react";
import { BrowserRouter, NavLink, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Streamers from "./pages/Streamers.jsx";
import Recordings from "./pages/Recordings.jsx";
import Settings from "./pages/Settings.jsx";
import { api } from "./api/client.js";

function Header({ onStarted }) {
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
    } finally {
      setLoading(false);
    }
  }

  const navClass = ({ isActive }) =>
    `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
      isActive
        ? "bg-white/10 text-white"
        : "text-white/60 hover:text-white hover:bg-white/5"
    }`;

  return (
    <header className="flex items-center gap-4 px-6 h-14 bg-zinc-900 border-b border-zinc-800 shrink-0">
      <span className="font-bold text-white tracking-tight mr-2">LiveRecorder</span>
      <nav className="flex gap-1">
        <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
        <NavLink to="/streamers" className={navClass}>Streamers</NavLink>
        <NavLink to="/recordings" className={navClass}>Recordings</NavLink>
        <NavLink to="/settings" className={navClass}>Settings</NavLink>
      </nav>
      <form onSubmit={handleStart} className="flex items-center gap-2 ml-auto">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL live Twitch / YouTube / TikTok..."
          className="w-72 px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm font-medium text-white transition-colors"
        >
          {loading ? "..." : "Enregistrer"}
        </button>
        {error && <span className="text-red-400 text-xs">{error}</span>}
      </form>
    </header>
  );
}

export default function App() {
  const [lastStarted, setLastStarted] = useState(null);

  const handleStarted = useCallback((id) => setLastStarted(id), []);

  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-zinc-950 text-white">
        <Header onStarted={handleStarted} />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard lastStarted={lastStarted} />} />
            <Route path="/streamers" element={<Streamers />} />
            <Route path="/recordings" element={<Recordings />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
