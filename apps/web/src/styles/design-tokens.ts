export const designTokens = {
  colors: {
    bg: {
      primary: "#070711",
      secondary: "#111226",
      tertiary: "#1a1d35",
      surface: "#0e111f",
      panel: "#131629",
    },
    text: {
      primary: "#f7f7ff",
      secondary: "#b7b9d9",
      tertiary: "#8a8faf",
      muted: "#686d8f",
    },
    border: {
      subtle: "#2a2f4a",
      default: "#3a4164",
      strong: "#4c5380",
    },
    brand: {
      50: "#f3fff8",
      100: "#ddfced",
      200: "#b8f6db",
      300: "#86edc5",
      400: "#4fdcae",
      500: "#2bc49d",
      600: "#3da9b4",
      700: "#5e84cc",
      800: "#7b63e0",
      900: "#6d4fc5",
      950: "#4a3288",
    },
    slate: {
      50: "#f4f3ff",
      100: "#e8e6ff",
      200: "#d2cdfc",
      300: "#b3acef",
      400: "#8f88d4",
      500: "#706bb0",
      600: "#58558c",
      700: "#434265",
      800: "#2f3048",
      900: "#1f2134",
      950: "#111322",
    },
    risk: {
      high: "#ef4444",
      med: "#f59e0b",
      low: "#6b7280",
      safe: "#10b981",
    },
    overlay: {
      graphMask: "rgba(2, 6, 23, 0.8)",
    },
  },
  gradients: {
    pageAtmosphere:
      "radial-gradient(ellipse 82% 62% at 18% -12%, rgba(43,196,157,0.28) 0%, transparent 68%), radial-gradient(ellipse 72% 58% at 84% 82%, rgba(123,99,224,0.24) 0%, transparent 66%), linear-gradient(145deg, rgba(21,24,43,0.35) 0%, rgba(9,11,23,0.72) 100%)",
    homeFeatureGlow:
      "radial-gradient(circle at 50% 0%, rgba(79,220,174,0.18) 0%, rgba(123,99,224,0.14) 48%, transparent 78%)",
    homeHeroHighlight:
      "radial-gradient(ellipse 90% 74% at 50% -18%, rgba(43,196,157,0.2) 0%, rgba(123,99,224,0.16) 44%, transparent 76%)",
    panelAi:
      "linear-gradient(135deg, rgba(43,196,157,0.16) 0%, rgba(123,99,224,0.2) 100%)",
  },
  typography: {
    fontFamily: {
      base: "system-ui, -apple-system, sans-serif",
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
    },
    fontSize: {
      xs: "0.625rem",
      sm: "0.75rem",
      base: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.5rem",
      xxl: "3rem",
    },
    letterSpacing: {
      tight: "-0.025em",
      wide: "0.08em",
      wider: "0.2em",
    },
  },
  spacing: {
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
    16: "4rem",
    20: "5rem",
  },
  radius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.625rem",
    xl: "0.75rem",
    pill: "9999px",
  },
  shadow: {
    soft: "0 8px 30px rgba(2, 6, 23, 0.35)",
    glow: "0 0 24px rgba(79, 220, 174, 0.22), 0 0 36px rgba(123, 99, 224, 0.2)",
  },
  layout: {
    navbarHeight: "3.5rem",
    gridSize: "60px 60px",
    nodeDetailWidth: "320px",
  },
} as const;

type Primitive = string | number;
type TokenTree = { [key: string]: Primitive | TokenTree };

function flattenTokens(
  tree: TokenTree,
  path: string[] = [],
): Array<[string, Primitive]> {
  return Object.entries(tree).flatMap(([key, value]) => {
    const nextPath = [...path, key];
    if (typeof value === "string" || typeof value === "number") {
      return [[nextPath.join("-"), value]];
    }
    return flattenTokens(value as TokenTree, nextPath);
  });
}

export function applyDesignTokens(
  root: HTMLElement = document.documentElement,
): void {
  for (const [name, value] of flattenTokens(
    designTokens as unknown as TokenTree,
  )) {
    root.style.setProperty(`--token-${name}`, String(value));
  }
}
