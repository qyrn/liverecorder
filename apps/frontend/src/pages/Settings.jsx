import React, { useState, useEffect } from "react";
import { api } from "../api/client.js";

const FIELDS = [
  { section: "Clés API", fields: [
    { key: "twitch_client_id", label: "Twitch Client ID", type: "text" },
    { key: "twitch_client_secret", label: "Twitch Client Secret", type: "password" },
    { key: "youtube_api_key", label: "YouTube API Key", type: "password" },
  ]},
  { section: "Chemins outils", fields: [
    { key: "ytdlp_path", label: "yt-dlp path", type: "text" },
    { key: "ffmpeg_path", label: "ffmpeg path", type: "text" },
    { key: "streamlink_path", label: "streamlink path", type: "text" },
  ]},
  { section: "Enregistrement", fields: [
    { key: "output_path", label: "Dossier de sortie", type: "text" },
    { key: "max_concurrent", label: "Max enregistrements simultanés", type: "number" },
  ]},
  { section: "Intervalles de polling (secondes)", fields: [
    { key: "poll_interval_twitch", label: "Twitch", type: "number" },
    { key: "poll_interval_youtube", label: "YouTube", type: "number" },
    { key: "poll_interval_tiktok", label: "TikTok", type: "number" },
  ]},
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
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Paramètres</h1>

      {health && (
        <div className="mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Statut des outils</p>
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              { name: "yt-dlp", ok: health.ytdlp?.ok },
              { name: "ffmpeg", ok: health.ffmpeg?.ok },
              { name: "streamlink", ok: health.streamlink?.ok },
              { name: "Twitch API", ok: health.twitch?.configured },
              { name: "YouTube API", ok: health.youtube?.configured },
            ].map(({ name, ok }) => (
              <div key={name} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
                <span className={ok ? "text-zinc-300" : "text-zinc-500"}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-8">
        {FIELDS.map(({ section, fields }) => (
          <div key={section}>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">{section}</p>
            <div className="flex flex-col gap-3">
              {fields.map(({ key, label, type }) => (
                <div key={key} className="flex items-center gap-4">
                  <label className="w-52 text-sm text-zinc-400 shrink-0">{label}</label>
                  <input
                    type={type}
                    value={values[key] ?? ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-sm text-white focus:outline-none focus:border-zinc-500"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-sm font-medium text-white transition-colors"
          >
            Sauvegarder
          </button>
          {saved && <span className="text-green-400 text-sm">Sauvegardé.</span>}
          {error && <span className="text-red-400 text-sm">{error}</span>}
        </div>
      </form>
    </div>
  );
}
