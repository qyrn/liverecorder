export const translations = {
  fr: {
    status: {
      recording: "EN COURS",
      completed: "OK",
      failed:    "ERREUR",
      cancelled: "ANNULÉ",
      pending:   "ATTENTE",
    },
    activeCount:     (n) => `${n} actif${n > 1 ? "s" : ""}`,
    stopping:        "Arrêt...",
    cancel:          "Annuler",
    settings:        "Paramètres",
    starting:        "Démarrage...",
    download:        "Télécharger",
    activeSection:   "En cours",
    historySection:  "Historique",
    totalDownloads:  (n) => `${n} téléchargement${n > 1 ? "s" : ""}`,
    noDownloads:     "Aucun téléchargement",
    page:            (n) => `Page ${n}`,
    settingsTitle:   "Paramètres",
    toolsStatus:     "État des outils",
    optional:        "optionnel",
    save:            "Sauvegarder",
    saved:           "Sauvegardé.",
    sectionPaths:    "Chemins outils",
    sectionDownload: "Téléchargement",
    sectionAdvanced: "Avancé",
    outputPath:      "Dossier de sortie",
    qualityMax:      "Qualité max",
    concurrent:      "Téléchargements simultanés",
    hlsWorkers:      "Workers HLS",
    ytdlpFragments:  "Fragments yt-dlp",
    qualityOptions: [
      { value: "source", label: "Source — meilleure qualité" },
      { value: "1080p",  label: "1080p — ~30-40% plus petit" },
      { value: "720p",   label: "720p — ~60% plus petit" },
      { value: "480p",   label: "480p — ~80% plus petit" },
    ],
    hintConcurrent:  "Nombre maximum de téléchargements en parallèle.",
    hintHls:         "Segments téléchargés en parallèle pour les VODs Twitch (bypass CloudFront). Défaut : 16.",
    hintFragments:   "Fragments simultanés pour yt-dlp (YouTube, TikTok, etc.). Défaut : 4.",
    dateLocale:      "fr-FR",
  },
  en: {
    status: {
      recording: "LIVE",
      completed: "DONE",
      failed:    "FAILED",
      cancelled: "CANCELLED",
      pending:   "PENDING",
    },
    activeCount:     (n) => `${n} active`,
    stopping:        "Stopping...",
    cancel:          "Cancel",
    settings:        "Settings",
    starting:        "Starting...",
    download:        "Download",
    activeSection:   "Active",
    historySection:  "History",
    totalDownloads:  (n) => `${n} download${n > 1 ? "s" : ""}`,
    noDownloads:     "No downloads",
    page:            (n) => `Page ${n}`,
    settingsTitle:   "Settings",
    toolsStatus:     "Tools status",
    optional:        "optional",
    save:            "Save",
    saved:           "Saved.",
    sectionPaths:    "Tool paths",
    sectionDownload: "Download",
    sectionAdvanced: "Advanced",
    outputPath:      "Output folder",
    qualityMax:      "Max quality",
    concurrent:      "Concurrent downloads",
    hlsWorkers:      "HLS workers",
    ytdlpFragments:  "yt-dlp fragments",
    qualityOptions: [
      { value: "source", label: "Source — best quality" },
      { value: "1080p",  label: "1080p — ~30-40% smaller" },
      { value: "720p",   label: "720p — ~60% smaller" },
      { value: "480p",   label: "480p — ~80% smaller" },
    ],
    hintConcurrent:  "Maximum number of parallel downloads.",
    hintHls:         "Parallel segments for Twitch VODs (CloudFront bypass). Default: 16.",
    hintFragments:   "Concurrent fragments for yt-dlp (YouTube, TikTok, etc.). Default: 4.",
    dateLocale:      "en-US",
  },
};

export function getLang() {
  const param = new URLSearchParams(window.location.search).get("lang");
  if (param === "fr" || param === "en") {
    localStorage.setItem("lr-lang", param);
    return param;
  }
  return localStorage.getItem("lr-lang") || "fr";
}

export function setLang(lang) {
  localStorage.setItem("lr-lang", lang);
  const url = new URL(window.location.href);
  url.searchParams.set("lang", lang);
  window.history.replaceState(null, "", url.toString());
}
