import { useState, useEffect, useRef } from "react";
import {
  Github,
  Zap,
  Lock,
  Monitor,
  Server,
  ArrowRight,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";

const GITHUB = "https://github.com/qyrn/liverecorder";

const T = {
  fr: {
    badge: "Enregistreur local · Windows · Open source",
    heroTitle: ["CAPTUREZ.", "GARDEZ.", "REJOUEZ."],
    heroSub:
      "Téléchargez vos streams Twitch, YouTube et TikTok directement sur votre machine — à vitesse maximale, sans cloud, sans compte.",
    ctaStart: "Commencer",
    benchmarkLabel: "2 benchmarks · Twitch · 24 fév 2026",
    statLabels: ["hugodelire · débit moyen", "grimkujow · 10h34 de VOD", "workers HLS parallèles"],
    statsFooter: "hevc 2560×1440 · h264 1920×1080 · 16 workers",
    featuresLabel: "Fonctionnalités",
    featuresTitle: "CONÇU POUR LA PERFORMANCE",
    features: [
      {
        title: "Vitesse brute",
        desc: "16 workers HLS en parallèle. 10h34 de live en 9 minutes. 65 MB/s de débit moyen sur le benchmark.",
      },
      {
        title: "Bypass Twitch",
        desc: "Téléchargez les VODs sub-only sans abonnement via reconstruction directe des URLs CloudFront.",
      },
      {
        title: "100 % local",
        desc: "Aucune donnée ne quitte votre machine. Aucun cloud, aucun compte, aucune limite artificielle.",
      },
      {
        title: "Dashboard web",
        desc: "Interface locale en temps réel. Progression live, historique des téléchargements, paramètres.",
      },
    ],
    platformsLabel: "Compatibilité",
    platformsTitle: "3 PLATEFORMES SUPPORTÉES",
    platforms: [
      { desc: "Bypass sub-only inclus. Qualité source jusqu'à 2K." },
      { desc: "Toutes qualités jusqu'à 4K. yt-dlp natif." },
      { desc: "Support complet via yt-dlp." },
    ],
    installLabel: "Installation",
    installTitle: "EN 3 ÉTAPES",
    steps: [
      {
        title: "Installez les dépendances",
        desc: "yt-dlp et ffmpeg doivent être présents sur votre machine Windows.",
      },
      {
        title: "Clonez et lancez",
        desc: "Clonez le repo. Lancez start.bat en double-cliquant dessus, ou start.ps1 depuis PowerShell.",
      },
      {
        title: "Collez une URL",
        desc: "Le dashboard s'ouvre sur http://localhost:3000. Collez une URL Twitch, YouTube ou TikTok et lancez.",
      },
    ],
    prereqs: "Pré-requis : Windows 10/11 · Node.js 18+ · yt-dlp · ffmpeg",
    license: "Licence MIT · 2026",
  },
  en: {
    badge: "Local recorder · Windows · Open source",
    heroTitle: ["CAPTURE.", "KEEP.", "REPLAY."],
    heroSub:
      "Download your Twitch, YouTube and TikTok streams directly to your machine — at full speed, no cloud, no account.",
    ctaStart: "Get started",
    benchmarkLabel: "2 benchmarks · Twitch · Feb 24 2026",
    statLabels: ["hugodelire · avg speed", "grimkujow · 10h34 VOD", "parallel HLS workers"],
    statsFooter: "hevc 2560×1440 · h264 1920×1080 · 16 workers",
    featuresLabel: "Features",
    featuresTitle: "BUILT FOR PERFORMANCE",
    features: [
      {
        title: "Raw speed",
        desc: "16 parallel HLS workers. 10h34 of live in 9 minutes. 65 MB/s average throughput on benchmark.",
      },
      {
        title: "Twitch bypass",
        desc: "Download subscriber-only VODs without a subscription by reconstructing CloudFront URLs directly.",
      },
      {
        title: "100% local",
        desc: "No data ever leaves your machine. No cloud, no account, no artificial limits.",
      },
      {
        title: "Web dashboard",
        desc: "Local real-time interface. Live progress, download history, settings.",
      },
    ],
    platformsLabel: "Compatibility",
    platformsTitle: "3 SUPPORTED PLATFORMS",
    platforms: [
      { desc: "Sub-only bypass included. Source quality up to 2K." },
      { desc: "All qualities up to 4K. Native yt-dlp." },
      { desc: "Full support via yt-dlp." },
    ],
    installLabel: "Setup",
    installTitle: "3 STEPS",
    steps: [
      {
        title: "Install dependencies",
        desc: "yt-dlp and ffmpeg must be present on your Windows machine.",
      },
      {
        title: "Clone and launch",
        desc: "Clone the repo. Double-click start.bat, or run start.ps1 from PowerShell.",
      },
      {
        title: "Paste a URL",
        desc: "The dashboard opens at http://localhost:3000. Paste a Twitch, YouTube or TikTok URL and go.",
      },
    ],
    prereqs: "Requirements: Windows 10/11 · Node.js 18+ · yt-dlp · ffmpeg",
    license: "MIT License · 2026",
  },
};

function useLang() {
  const [lang, setLang] = useState(() => {
    const param = new URLSearchParams(window.location.search).get("lang");
    if (param === "fr" || param === "en") {
      localStorage.setItem("lr-lang", param);
      return param;
    }
    return localStorage.getItem("lr-lang") || "fr";
  });

  const toggle = () => {
    const next = lang === "fr" ? "en" : "fr";
    localStorage.setItem("lr-lang", next);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url.toString());
    setLang(next);
  };

  return [lang, toggle];
}

function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function useCounter(target, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const raf = (ts) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setValue(ease * target);
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [start, target, duration]);
  return value;
}

const FEATURE_ACCENTS = ["#e63946", "#9147ff", "#22c55e", "#f59e0b"];
const FEATURE_ICONS = [Zap, Lock, Server, Monitor];

const PLATFORMS = [
  { name: "Twitch", color: "#9147ff", tag: "VODs · Highlights · Clips" },
  { name: "YouTube", color: "#ff0000", tag: "Videos · Archived lives" },
  { name: "TikTok", color: "#ff0050", tag: "Videos · Lives" },
];

const PLATFORMS_FR = [
  { name: "Twitch", color: "#9147ff", tag: "VODs · Highlights · Clips" },
  { name: "YouTube", color: "#ff0000", tag: "Vidéos · Lives archivés" },
  { name: "TikTok", color: "#ff0050", tag: "Vidéos · Lives" },
];

export default function App() {
  const [lang, toggleLang] = useLang();
  const t = T[lang];

  const [statsRef, statsInView] = useInView(0.3);
  const speed = useCounter(65.5, 1800, statsInView);
  const mins = useCounter(9, 1400, statsInView);
  const workers = useCounter(16, 1200, statsInView);

  const platforms = lang === "fr" ? PLATFORMS_FR : PLATFORMS;

  const stepCodes = [
    "winget install yt-dlp.yt-dlp\nwinget install Gyan.FFmpeg",
    `git clone ${GITHUB}\ncd liverecorder\n\n${lang === "fr" ? "# Depuis l'explorateur Windows :" : "# From Windows Explorer:"}\nstart.bat\n\n${lang === "fr" ? "# Ou depuis PowerShell :" : "# Or from PowerShell:"}\n.\\start.ps1`,
    "https://www.twitch.tv/videos/2703786928\nhttps://www.youtube.com/watch?v=...",
  ];

  return (
    <div>
      <Nav lang={lang} toggleLang={toggleLang} />

      <section className="hero grid-bg">
        <div className="hero-inner">
          <div>
            <div className="hero-badge animate-fade-up">
              <span
                className="rec-dot"
                style={{ width: 7, height: 7, borderRadius: "50%", background: "#e63946", display: "inline-block", flexShrink: 0 }}
              />
              {t.badge}
            </div>
            <h1 className="hero-title animate-fade-up" style={{ animationDelay: "0.08s" }}>
              {t.heroTitle[0]}
              <br />
              {t.heroTitle[1]}
              <br />
              <span style={{ color: "var(--accent)" }}>{t.heroTitle[2]}</span>
            </h1>
            <p className="hero-sub animate-fade-up" style={{ animationDelay: "0.16s" }}>
              {t.heroSub}
            </p>
            <div className="hero-actions animate-fade-up" style={{ animationDelay: "0.24s" }}>
              <a href="#install" className="btn-primary">
                {t.ctaStart} <ArrowRight size={15} />
              </a>
              <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <Github size={15} /> GitHub
              </a>
            </div>
          </div>

          <div ref={statsRef} className="stats-card animate-fade-up" style={{ animationDelay: "0.32s" }}>
            <div className="stats-card-header">
              <span className="rec-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#e63946", display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                {t.benchmarkLabel}
              </span>
            </div>
            <div className="stats-card-body">
              <StatItem value={speed} decimals={1} unit="MB/s" label={t.statLabels[0]} />
              <div className="stats-divider" />
              <StatItem value={mins} decimals={0} unit="min" label={t.statLabels[1]} />
              <div className="stats-divider" />
              <StatItem value={workers} decimals={0} unit="×" label={t.statLabels[2]} />
            </div>
            <div className="stats-card-footer">{t.statsFooter}</div>
          </div>
        </div>
        <div className="hero-scroll-hint">
          <ChevronDown size={20} style={{ opacity: 0.25 }} />
        </div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <SectionLabel>{t.featuresLabel}</SectionLabel>
          <h2 className="section-title">{t.featuresTitle}</h2>
          <div className="features-grid">
            {t.features.map((f, i) => (
              <FeatureCard key={i} icon={FEATURE_ICONS[i]} title={f.title} desc={f.desc} accent={FEATURE_ACCENTS[i]} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="platforms">
        <div className="container">
          <SectionLabel>{t.platformsLabel}</SectionLabel>
          <h2 className="section-title">{t.platformsTitle}</h2>
          <div className="platforms-grid">
            {platforms.map((p, i) => (
              <PlatformCard key={p.name} {...p} desc={t.platforms[i].desc} />
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="install">
        <div className="container">
          <SectionLabel>{t.installLabel}</SectionLabel>
          <h2 className="section-title">{t.installTitle}</h2>
          <div className="steps-list">
            {t.steps.map((s, i) => (
              <StepCard key={i} num={`0${i + 1}`} title={s.title} desc={s.desc} code={stepCodes[i]} delay={i * 100} />
            ))}
          </div>
          <p className="install-note" style={{ marginTop: 48 }}>{t.prereqs}</p>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-logo">
            <span className="rec-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#e63946", display: "inline-block" }} />
            LIVERECORDER
          </div>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>{t.license}</span>
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none" }}>
            <Github size={15} /> GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

function Nav({ lang, toggleLang }) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-logo">
          <span className="rec-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#e63946", display: "inline-block" }} />
          LIVERECORDER
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={toggleLang} className="lang-toggle">
            {lang === "fr" ? "EN" : "FR"}
          </button>
          <a href={GITHUB} target="_blank" rel="noopener noreferrer" className="nav-github">
            <Github size={15} />
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}

function StatItem({ value, decimals, unit, label }) {
  return (
    <div className="stat-item">
      <div className="stat-value">
        {decimals > 0 ? value.toFixed(decimals) : Math.round(value)}
        <span className="stat-unit">{unit}</span>
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>;
}

function FeatureCard({ icon: Icon, title, desc, accent }) {
  const [ref, inView] = useInView(0.15);
  return (
    <div ref={ref} className={`feature-card${inView ? " in-view" : ""}`}>
      <div className="feature-icon" style={{ color: accent, background: `${accent}18` }}>
        <Icon size={21} />
      </div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{desc}</p>
    </div>
  );
}

function PlatformCard({ name, color, tag, desc }) {
  const [ref, inView] = useInView(0.15);
  return (
    <div ref={ref} className={`platform-card${inView ? " in-view" : ""}`} style={{ "--platform-color": color }}>
      <div className="platform-bar" style={{ background: color }} />
      <div className="platform-content">
        <h3 className="platform-name">{name}</h3>
        <div className="platform-tag">{tag}</div>
        <p className="platform-desc">{desc}</p>
      </div>
    </div>
  );
}

function StepCard({ num, title, desc, code, delay }) {
  const [ref, inView] = useInView(0.15);
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div ref={ref} className={`step-card${inView ? " in-view" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="step-num">{num}</div>
      <div className="step-body">
        <h3 className="step-title">{title}</h3>
        <p className="step-desc">{desc}</p>
        <div className="step-code terminal">
          <div className="step-code-header terminal-header">
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--muted)" }}>
              PowerShell
            </span>
            <button onClick={handleCopy} className="copy-btn">
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <pre className="step-code-body">{code}</pre>
        </div>
      </div>
    </div>
  );
}
