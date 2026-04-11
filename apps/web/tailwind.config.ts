import type { Config } from "tailwindcss";
import { designTokens } from "./src/styles/design-tokens";

const { colors, spacing, typography, radius, shadow } = designTokens;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        xrp: colors.brand,
        slate: colors.slate,
        app: {
          bg: colors.bg,
          text: colors.text,
          border: colors.border,
          risk: colors.risk,
        },
      },
      spacing,
      borderRadius: radius,
      boxShadow: shadow,
      fontSize: typography.fontSize,
      fontFamily: {
        sans: [typography.fontFamily.base],
        mono: [typography.fontFamily.mono],
      },
      letterSpacing: typography.letterSpacing,
    },
  },
  plugins: [],
} satisfies Config;
