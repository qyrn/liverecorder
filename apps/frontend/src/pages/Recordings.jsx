import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../api/client.js";

const PLATFORM_COLORS = { twitch: "#9147ff", youtube: "#ff0000", tiktok: "#ff0050" };

const STATUS_STYLES = {
  recording: { color: "#e63946", label: "REC" },
  completed: { color: "#22c55e", label: "OK" },
  failed:    { color: "#f59e0b", label: "ERR" },
  cancelled: { color: "#3d3d3d", label: "ANN" },
  pending:   { color: "#555", label: "WAIT" },
};

function fmt_size(b) {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

function fmt_dur(s) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

function fmt_date(iso) {
  if (!iso) return "—";
  return iso.slice(0, 16).replace("T", " ");
}

const STATUSES = [
  { value: "", label: "Tous" },
  { value: "recording", label: "En cours" },
  { value: "completed", label: "Terminés" },
  { value: "failed", label: "Échoués" },
  { value: "cancelled", label: "Annulés" },
];

export default function Recordings() {
  const [data, setData] = useState({ rows: [], total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await api.recordings.list({ page, limit: 50, ...(statusFilter ? { status: statusFilter } : {}) });
      setData(result);
    } catch {}
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            Recordings
          </h1>
          <p style={{ fontSize: 11, color: "#333", margin: 0 }}>
            {data.total} enregistrement{data.total !== 1 ? "s" : ""}
          </p>
        </div>

        <div style={{ display: "flex", gap: 2 }}>
          {STATUSES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setStatusFilter(value); setPage(1); }}
              style={{
                padding: "5px 12px",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: statusFilter === value ? "rgba(255,255,255,0.06)" : "transparent",
                border: "1px solid",
                borderColor: statusFilter === value ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                color: statusFilter === value ? "#efefef" : "#444",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {data.rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <p style={{ fontSize: 11, color: "#2d2d2d", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Aucun enregistrement
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["#", "Streamer", "Plateforme", "Titre", "Taille", "Durée", "Statut", "Date"].map((h) => (
                  <th key={h} style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 9,
                    color: "#2d2d2d",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 400,
                    whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, idx) => {
                const st = STATUS_STYLES[r.status] ?? STATUS_STYLES.pending;
                const pc = PLATFORM_COLORS[r.platform];
                return (
                  <tr
                    key={r.id}
                    className="sweep-in"
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      animationDelay: `${idx * 0.02}s`,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <td className="tabnum" style={{ padding: "10px 14px", color: "#2d2d2d" }}>{r.id}</td>
                    <td style={{ padding: "10px 14px", color: "#bbb", whiteSpace: "nowrap" }}>
                      {r.streamer_name ?? <span style={{ color: "#333" }}>Manuel</span>}
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: pc, display: "inline-block" }} />
                        <span style={{ color: "#555" }}>{r.platform}</span>
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#555", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.stream_title ?? "—"}
                    </td>
                    <td className="tabnum" style={{ padding: "10px 14px", color: "#777", whiteSpace: "nowrap" }}>{fmt_size(r.file_size_bytes)}</td>
                    <td className="tabnum" style={{ padding: "10px 14px", color: "#777", whiteSpace: "nowrap" }}>{fmt_dur(r.duration_sec)}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <span style={{
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        padding: "2px 7px",
                        color: st.color,
                        background: `${st.color}18`,
                        display: "inline-block",
                      }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="tabnum" style={{ padding: "10px 14px", color: "#3d3d3d", whiteSpace: "nowrap" }}>{fmt_date(r.started_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.total > 50 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button className="btn-ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={12} />
          </button>
          <span style={{ fontSize: 11, color: "#444" }}>Page {page}</span>
          <button className="btn-ghost" onClick={() => setPage((p) => p + 1)} disabled={data.rows.length < 50}>
            <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
