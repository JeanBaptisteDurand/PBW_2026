import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        xrp: {
          50: "#eaf2ff",
          100: "#cfe0ff",
          200: "#9fc0ff",
          300: "#6f9eff",
          400: "#467df0",
          500: "#2960d8",
          600: "#1f4ab0",
          700: "#173987",
          800: "#102862",
          900: "#0a1a40",
        },
        risk: {
          low: "#3dcf7c",
          med: "#f3a43e",
          high: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
