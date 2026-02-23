export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Syne", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        base: "#080808",
        surface: "#101010",
        elevated: "#181818",
        border: "rgba(255,255,255,0.06)",
        "border-strong": "rgba(255,255,255,0.12)",
        rec: "#e63946",
        "rec-dim": "rgba(230,57,70,0.12)",
        twitch: "#9147ff",
        youtube: "#ff0000",
        tiktok: "#ff0050",
        success: "#22c55e",
        warning: "#f59e0b",
      },
      animation: {
        "rec-pulse": "rec-pulse 1.8s ease-in-out infinite",
        "fade-up": "fade-up 0.3s ease both",
      },
      keyframes: {
        "rec-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
