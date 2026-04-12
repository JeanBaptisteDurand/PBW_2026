import { useEffect, useMemo, useRef, useState } from "react";
import createGlobe, { type Arc, type Marker } from "cobe";
import type { CorridorListItem } from "@corlens/core";

// ─── Corridor Globe ─────────────────────────────────────────────────────
// Professional smooth-black dotted earth with glowing great-circle arcs
// drawn between fiat-fiat corridor endpoints. Uses cobe v2's native arcs
// + markers so rotation, depth, and atmospheric blending all stay in
// lock-step with the rendered sphere.
//
// Interaction model:
//   • Currency labels are permanently rendered above every financial
//     centre and tracked frame-by-frame to cobe's phi/theta rotation.
//   • Clicking a label selects that currency: arcs are filtered to the
//     corridors touching it, auto-spin pauses, and a floating panel
//     surfaces every connected currency as a clickable chip that
//     navigates to the corresponding corridor detail page.
//   • Clicking empty space (or the selected label again) clears the
//     selection and resumes the auto-spin.

// Major financial centre for each fiat currency we render on the globe.
// Only fiat-fiat corridors are drawn; stables/XRP/crypto are filtered out.
const FIAT_COORDS: Record<
  string,
  { lat: number; lng: number; city: string; flag: string }
> = {
  USD: { lat: 40.7128, lng: -74.006, city: "New York", flag: "🇺🇸" },
  EUR: { lat: 50.1109, lng: 8.6821, city: "Frankfurt", flag: "🇪🇺" },
  GBP: { lat: 51.5074, lng: -0.1278, city: "London", flag: "🇬🇧" },
  JPY: { lat: 35.6762, lng: 139.6503, city: "Tokyo", flag: "🇯🇵" },
  CNY: { lat: 31.2304, lng: 121.4737, city: "Shanghai", flag: "🇨🇳" },
  CHF: { lat: 47.3769, lng: 8.5417, city: "Zurich", flag: "🇨🇭" },
  AUD: { lat: -33.8688, lng: 151.2093, city: "Sydney", flag: "🇦🇺" },
  CAD: { lat: 43.6532, lng: -79.3832, city: "Toronto", flag: "🇨🇦" },
  HKD: { lat: 22.3193, lng: 114.1694, city: "Hong Kong", flag: "🇭🇰" },
  SGD: { lat: 1.3521, lng: 103.8198, city: "Singapore", flag: "🇸🇬" },
  INR: { lat: 19.076, lng: 72.8777, city: "Mumbai", flag: "🇮🇳" },
  KRW: { lat: 37.5665, lng: 126.978, city: "Seoul", flag: "🇰🇷" },
  BRL: { lat: -23.5505, lng: -46.6333, city: "São Paulo", flag: "🇧🇷" },
  MXN: { lat: 19.4326, lng: -99.1332, city: "Mexico City", flag: "🇲🇽" },
  NZD: { lat: -36.8485, lng: 174.7633, city: "Auckland", flag: "🇳🇿" },
  SEK: { lat: 59.3293, lng: 18.0686, city: "Stockholm", flag: "🇸🇪" },
  NOK: { lat: 59.9139, lng: 10.7522, city: "Oslo", flag: "🇳🇴" },
  DKK: { lat: 55.6761, lng: 12.5683, city: "Copenhagen", flag: "🇩🇰" },
  ZAR: { lat: -26.2041, lng: 28.0473, city: "Johannesburg", flag: "🇿🇦" },
  RUB: { lat: 55.7558, lng: 37.6173, city: "Moscow", flag: "🇷🇺" },
  TRY: { lat: 41.0082, lng: 28.9784, city: "Istanbul", flag: "🇹🇷" },
  AED: { lat: 25.2048, lng: 55.2708, city: "Dubai", flag: "🇦🇪" },
  SAR: { lat: 24.7136, lng: 46.6753, city: "Riyadh", flag: "🇸🇦" },
  THB: { lat: 13.7563, lng: 100.5018, city: "Bangkok", flag: "🇹🇭" },
  IDR: { lat: -6.2088, lng: 106.8456, city: "Jakarta", flag: "🇮🇩" },
  PHP: { lat: 14.5995, lng: 120.9842, city: "Manila", flag: "🇵🇭" },
  MYR: { lat: 3.139, lng: 101.6869, city: "Kuala Lumpur", flag: "🇲🇾" },
  VND: { lat: 10.8231, lng: 106.6297, city: "Ho Chi Minh", flag: "🇻🇳" },
  ILS: { lat: 32.0853, lng: 34.7818, city: "Tel Aviv", flag: "🇮🇱" },
  EGP: { lat: 30.0444, lng: 31.2357, city: "Cairo", flag: "🇪🇬" },
  NGN: { lat: 6.5244, lng: 3.3792, city: "Lagos", flag: "🇳🇬" },
  PLN: { lat: 52.2297, lng: 21.0122, city: "Warsaw", flag: "🇵🇱" },
  CZK: { lat: 50.0755, lng: 14.4378, city: "Prague", flag: "🇨🇿" },
  HUF: { lat: 47.4979, lng: 19.0402, city: "Budapest", flag: "🇭🇺" },
  TWD: { lat: 25.033, lng: 121.5654, city: "Taipei", flag: "🇹🇼" },
  ARS: { lat: -34.6037, lng: -58.3816, city: "Buenos Aires", flag: "🇦🇷" },
  CLP: { lat: -33.4489, lng: -70.6693, city: "Santiago", flag: "🇨🇱" },
  COP: { lat: 4.711, lng: -74.0721, city: "Bogotá", flag: "🇨🇴" },
  PEN: { lat: -12.0464, lng: -77.0428, city: "Lima", flag: "🇵🇪" },
};

// Map corridor status → arc colour. Desaturated on purpose so the overall
// impression stays "professional smooth black", not candy rainbow. Cobe
// expects linear-ish 0-1 RGB.
const STATUS_COLOR: Record<string, [number, number, number]> = {
  GREEN: [0.38, 0.82, 0.64], // muted mint
  AMBER: [0.92, 0.72, 0.32], // soft amber
  RED: [0.88, 0.36, 0.44], // dusty red
  UNKNOWN: [0.48, 0.66, 0.88], // slate blue fallback
};

// The colour we tint arcs when one endpoint is the selected currency.
const SELECTED_COLOR: [number, number, number] = [0.72, 0.92, 1.0];

// Cobe internals — duplicated so we can replicate its marker projection
// for the HTML label overlay (cobe doesn't expose this directly).
const COBE_SPHERE_RADIUS = 0.8;
const COBE_MARKER_ELEV = 0.008;

function latLngToCobeVec3(
  lat: number,
  lng: number,
): [number, number, number] {
  // Matches cobe's internal `U([lat,lng])` function exactly.
  const r = (lat * Math.PI) / 180;
  const a = (lng * Math.PI) / 180 - Math.PI;
  const o = Math.cos(r);
  return [-o * Math.cos(a), Math.sin(r), o * Math.sin(a)];
}

// Project a 3D sphere vector through cobe's phi (yaw) + theta (pitch)
// and return fractional [x, y] in [0..1] plus a visibility flag. Mirrors
// cobe's internal `O(t)` projection so HTML labels track the sphere
// frame-perfect.
function projectCobe(
  v: [number, number, number],
  phi: number,
  theta: number,
  aspect: number,
): { x: number; y: number; visible: boolean; depth: number } {
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const c = cp * v[0] + sp * v[2];
  const s = sp * st * v[0] + ct * v[1] - cp * st * v[2];
  const z = -sp * ct * v[0] + st * v[1] + cp * ct * v[2];
  const x = (c / aspect + 1) / 2;
  const y = (-s + 1) / 2;
  return { x, y, visible: z >= -0.05, depth: z };
}

export interface CorridorGlobeProps {
  corridors: CorridorListItem[];
  onCorridorClick?: (id: string) => void;
}

interface LabelEntry {
  symbol: string;
  city: string;
  flag: string;
  lat: number;
  lng: number;
  vec: [number, number, number];
  connections: number;
}

export function CorridorGlobe({
  corridors,
  onCorridorClick,
}: CorridorGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelsLayerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Rotation state is kept in refs so the cobe effect and the label
  // overlay effect can both read + write it across re-renders without
  // triggering reconciliation.
  const phiRef = useRef(0.6);
  const thetaRef = useRef(0.18);
  const autoSpinRef = useRef(true);
  const resumeAtRef = useRef(0);

  // Derive fiat-fiat corridors we can actually place on the globe. The
  // catalog now contains 2000+ off-chain-bridge corridors (every fiat pair
  // reachable via RLUSD/XRP on XRPL), which would produce visual spaghetti
  // if drawn all at once. We therefore cap the arc count to a visual
  // budget, keeping the highest-signal lanes: every corridor with an ODL
  // partner or RLUSD actor surfaces first, the rest fall back to pure
  // importance ranking. When a currency is selected in the floating panel,
  // all of its incident corridors are always drawn regardless of the cap.
  const MAX_ARCS = 220;
  const drawable = useMemo(() => {
    const candidates = corridors.filter(
      (c) =>
        c.source.type === "fiat" &&
        c.dest.type === "fiat" &&
        FIAT_COORDS[c.source.symbol] &&
        FIAT_COORDS[c.dest.symbol] &&
        c.source.symbol !== c.dest.symbol,
    );
    // Signal score: ODL presence + RLUSD support + intrinsic importance.
    // Higher = drawn first.
    const scoreOf = (c: CorridorListItem): number => {
      const actors = [
        ...(c.sourceActors ?? []),
        ...(c.destActors ?? []),
      ];
      const odl = actors.filter((a) => a.odl).length;
      const rlusd = actors.filter((a) => a.supportsRlusd).length;
      return c.importance + odl * 12 + rlusd * 6;
    };
    candidates.sort((a, b) => scoreOf(b) - scoreOf(a));
    return candidates.slice(0, MAX_ARCS);
  }, [corridors]);

  // Unique currency labels — one per fiat symbol that participates in
  // ANY geocoded fiat corridor (we use the uncapped list so every label
  // on a known financial centre is clickable, even if its corridors fall
  // outside the visual cap).
  const labels = useMemo<LabelEntry[]>(() => {
    const map = new Map<string, LabelEntry>();
    const source = corridors.filter(
      (c) =>
        c.source.type === "fiat" &&
        c.dest.type === "fiat" &&
        FIAT_COORDS[c.source.symbol] &&
        FIAT_COORDS[c.dest.symbol] &&
        c.source.symbol !== c.dest.symbol,
    );
    for (const c of source) {
      for (const sym of [c.source.symbol, c.dest.symbol]) {
        const coord = FIAT_COORDS[sym];
        if (!coord) continue;
        let entry = map.get(sym);
        if (!entry) {
          entry = {
            symbol: sym,
            city: coord.city,
            flag: coord.flag,
            lat: coord.lat,
            lng: coord.lng,
            vec: latLngToCobeVec3(coord.lat, coord.lng),
            connections: 0,
          };
          map.set(sym, entry);
        }
        entry.connections += 1;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.connections - a.connections,
    );
  }, [corridors]);

  // Full list of all geocoded fiat corridors, not just the drawable cap.
  // Selection uses this so every incident corridor of the selected
  // currency surfaces in the floating panel, even if it's outside the
  // top-220 drawn on the globe.
  const allFiatCorridors = useMemo(() => {
    return corridors.filter(
      (c) =>
        c.source.type === "fiat" &&
        c.dest.type === "fiat" &&
        FIAT_COORDS[c.source.symbol] &&
        FIAT_COORDS[c.dest.symbol] &&
        c.source.symbol !== c.dest.symbol,
    );
  }, [corridors]);

  // When a currency is selected, only corridors touching it are
  // considered "connected". Used by both arc filtering and the
  // floating connections panel.
  const connectedSymbols = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>();
    for (const c of allFiatCorridors) {
      if (c.source.symbol === selected) s.add(c.dest.symbol);
      else if (c.dest.symbol === selected) s.add(c.source.symbol);
    }
    return s;
  }, [allFiatCorridors, selected]);

  // Corridors involving the selected currency, grouped by counterpart
  // symbol. A counterpart may have two entries (one each direction) —
  // we keep them both so the panel can surface either detail page.
  const selectedCorridors = useMemo(() => {
    if (!selected) return [] as CorridorListItem[];
    return allFiatCorridors.filter(
      (c) => c.source.symbol === selected || c.dest.symbol === selected,
    );
  }, [allFiatCorridors, selected]);

  const markers = useMemo<Marker[]>(() => {
    return labels.map((l) => ({
      location: [l.lat, l.lng] as [number, number],
      size: 0.042 + Math.min(0.04, l.connections * 0.003),
      color:
        selected && (l.symbol === selected || connectedSymbols.has(l.symbol))
          ? [0.78, 0.94, 1.0]
          : [0.52, 0.74, 0.92],
    }));
  }, [labels, selected, connectedSymbols]);

  const arcs = useMemo<Arc[]>(() => {
    // When a currency is selected, draw ALL incident corridors from the
    // full list (bypass the visual cap). When nothing is selected, draw
    // only the capped drawable set so the initial view stays readable.
    const source = selected
      ? allFiatCorridors.filter(
          (c) => c.source.symbol === selected || c.dest.symbol === selected,
        )
      : drawable;
    return source.map((c) => {
      const s = FIAT_COORDS[c.source.symbol];
      const d = FIAT_COORDS[c.dest.symbol];
      return {
        from: [s.lat, s.lng],
        to: [d.lat, d.lng],
        color: selected
          ? SELECTED_COLOR
          : STATUS_COLOR[c.status] ?? STATUS_COLOR.UNKNOWN,
        id: c.id,
      };
    });
  }, [drawable, allFiatCorridors, selected]);

  const arcCount = arcs.length;
  const markerCount = labels.length;

  // ─── cobe globe lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = container.offsetWidth;
    let height = container.offsetHeight;
    let rafId = 0;
    let pointerDown: { x: number; phi: number } | null = null;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: height * dpr,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 1.35,
      mapSamples: 24000,
      mapBrightness: 5.2,
      baseColor: [0.11, 0.13, 0.17],
      markerColor: [0.58, 0.82, 0.98],
      glowColor: [0.14, 0.18, 0.26],
      markers,
      arcs,
      arcColor: [0.48, 0.66, 0.88],
      arcWidth: selected ? 1.1 : 0.9,
      arcHeight: 0.22,
      markerElevation: COBE_MARKER_ELEV,
      context: { preserveDrawingBuffer: true },
    });

    const tick = (now: number) => {
      if (autoSpinRef.current && !pointerDown && now >= resumeAtRef.current) {
        phiRef.current += 0.0024;
      }
      const nextW = container.offsetWidth;
      const nextH = container.offsetHeight;
      if (nextW !== width || nextH !== height) {
        width = nextW;
        height = nextH;
      }
      globe.update({
        phi: phiRef.current,
        theta: thetaRef.current,
        width: width * dpr,
        height: height * dpr,
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const onPointerDown = (e: PointerEvent) => {
      pointerDown = { x: e.clientX, phi: phiRef.current };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      const dx = e.clientX - pointerDown.x;
      phiRef.current = pointerDown.phi + dx * 0.005;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDown) return;
      pointerDown = null;
      canvas.style.cursor = "grab";
      resumeAtRef.current = performance.now() + 1500;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
    canvas.style.cursor = "grab";

    const fadeIn = setTimeout(() => setReady(true), 40);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
      clearTimeout(fadeIn);
      globe.destroy();
    };
  }, [markers, arcs, selected]);

  // ─── label overlay: replicate cobe's projection each frame ────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsLayerRef.current;
    if (!canvas || !layer) return;
    let rafId = 0;

    const tick = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (w > 0 && h > 0) {
        const aspect = w / h;
        const phi = phiRef.current;
        const theta = thetaRef.current;
        const children = layer.children as HTMLCollectionOf<HTMLElement>;
        for (let i = 0; i < children.length; i++) {
          const el = children[i];
          const idx = Number(el.dataset.idx);
          const label = labels[idx];
          if (!label) continue;
          // Place the label slightly above the marker surface for
          // readability; cobe's sphere radius is 0.8.
          const lift = COBE_SPHERE_RADIUS + COBE_MARKER_ELEV + 0.02;
          const v: [number, number, number] = [
            label.vec[0] * lift,
            label.vec[1] * lift,
            label.vec[2] * lift,
          ];
          const p = projectCobe(v, phi, theta, aspect);
          if (!p.visible) {
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
            continue;
          }
          // Depth fade: labels on the horizon are dimmed.
          const depthFade = Math.max(0.15, Math.min(1, p.depth * 1.8 + 0.3));
          el.style.left = `${p.x * 100}%`;
          el.style.top = `${p.y * 100}%`;
          const isSelected = selected === label.symbol;
          const isConnected =
            selected != null && connectedSymbols.has(label.symbol);
          const isDimmed = selected != null && !isSelected && !isConnected;
          const scale = isSelected ? 1.18 : isConnected ? 1.05 : 0.92;
          el.style.transform = `translate(-50%, -50%) scale(${scale})`;
          el.style.opacity = String(
            isDimmed ? 0.18 * depthFade : depthFade,
          );
          el.style.pointerEvents = "auto";
          el.style.zIndex = String(Math.round(p.depth * 100) + 10);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [labels, selected, connectedSymbols]);

  // ─── selection changes: pause auto-spin while a currency is active ────
  useEffect(() => {
    if (selected) {
      autoSpinRef.current = false;
    } else {
      // Small grace period then resume so we don't immediately jerk.
      resumeAtRef.current = performance.now() + 400;
      autoSpinRef.current = true;
    }
  }, [selected]);

  // Click a label → toggle selection. Clicking the same label deselects.
  const handleLabelClick = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected((prev) => (prev === symbol ? null : symbol));
  };

  // Pause auto-spin while the user is hovering the globe so labels are
  // stable enough to read + click comfortably.
  const handleMouseEnter = () => {
    autoSpinRef.current = false;
  };
  const handleMouseLeave = () => {
    // Only resume if nothing is actively selected.
    if (!selected) {
      resumeAtRef.current = performance.now() + 400;
      autoSpinRef.current = true;
    }
  };

  // Click anywhere on the background → clear selection.
  const handleBackgroundClick = () => {
    if (selected) setSelected(null);
  };

  const selectedLabel = selected ? FIAT_COORDS[selected] : null;

  return (
    <div
      ref={containerRef}
      data-testid="corridor-globe"
      className="relative w-full overflow-hidden rounded-2xl border border-white/[0.06]"
      style={{
        height: 520,
        background:
          "radial-gradient(ellipse 70% 55% at 50% 45%, rgba(30,50,80,0.28) 0%, rgba(6,8,12,0.95) 55%, #000 100%)",
        boxShadow:
          "inset 0 0 120px 10px rgba(0,0,0,0.85), 0 30px 80px -20px rgba(0,0,0,0.9)",
      }}
      onClick={handleBackgroundClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Grain / noise layer for professional matte finish */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Vignette ring around the sphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 42%, rgba(0,0,0,0.55) 75%, rgba(0,0,0,0.95) 100%)",
        }}
      />

      <canvas
        ref={canvasRef}
        data-testid="corridor-globe-canvas"
        style={{
          width: "100%",
          height: "100%",
          contain: "layout paint size",
          opacity: ready ? 1 : 0,
          transition: "opacity 900ms ease",
          touchAction: "none",
        }}
      />

      {/* Currency labels overlay — positioned every frame to match cobe */}
      <div
        ref={labelsLayerRef}
        data-testid="corridor-globe-labels"
        className="pointer-events-none absolute inset-0"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 900ms ease" }}
      >
        {labels.map((l, idx) => (
          <button
            key={l.symbol}
            type="button"
            data-idx={idx}
            data-symbol={l.symbol}
            data-testid={`globe-label-${l.symbol}`}
            onClick={(e) => handleLabelClick(l.symbol, e)}
            className="absolute flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-md transition-[transform,background,border-color,box-shadow] hover:border-cyan-300/60 hover:bg-black/80"
            style={{
              // Will be overwritten by RAF tick.
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              willChange: "transform, left, top, opacity",
              boxShadow:
                selected === l.symbol
                  ? "0 0 0 1px rgba(165,243,252,0.8), 0 0 22px 2px rgba(56,189,248,0.35)"
                  : "0 2px 10px rgba(0,0,0,0.5)",
              borderColor:
                selected === l.symbol
                  ? "rgba(165,243,252,0.85)"
                  : undefined,
            }}
          >
            <span className="text-[11px] leading-none">{l.flag}</span>
            <span>{l.symbol}</span>
          </button>
        ))}
      </div>

      {/* Corner chrome */}
      <div className="pointer-events-none absolute top-5 left-6 flex flex-col gap-1">
        <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">
          XRPL · Fiat Corridor Network
        </div>
        <div
          className="font-mono text-[11px] text-white/70"
          data-testid="globe-stats"
        >
          {arcCount} fiat corridors · {markerCount} financial centres
        </div>
      </div>

      <div className="pointer-events-none absolute top-5 right-6 flex items-center gap-4 text-[9px] font-mono uppercase tracking-widest text-white/50">
        <LegendDot color="rgb(97, 209, 163)" label="Green" />
        <LegendDot color="rgb(234, 183, 82)" label="Amber" />
        <LegendDot color="rgb(224, 92, 112)" label="Red" />
      </div>

      <div className="pointer-events-none absolute bottom-5 left-6 text-[9px] font-mono uppercase tracking-widest text-white/30">
        {selected
          ? "Click empty space to clear · Click a chip in the side panel to open a corridor"
          : "Click a currency to reveal its connections · Drag to rotate"}
      </div>

      <div className="pointer-events-none absolute bottom-5 right-6 text-[9px] font-mono uppercase tracking-[0.25em] text-white/30">
        Live mainnet · scanned hourly
      </div>

      {/* Selected currency connections panel — docked to the right edge
          so it never blocks the globe itself. Scrolls vertically when a
          currency has many corridors (e.g. USD with 47+ counterparts). */}
      {selected && selectedLabel && (
        <div
          data-testid="globe-selection-panel"
          className="absolute top-16 right-4 bottom-12 w-[min(340px,calc(100%-2rem))] flex flex-col rounded-xl border border-cyan-300/20 bg-black/75 backdrop-blur-xl overflow-hidden"
          style={{
            boxShadow:
              "0 20px 60px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(165,243,252,0.08)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg leading-none shrink-0">
                {selectedLabel.flag}
              </span>
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-cyan-200/70 truncate">
                  {selectedLabel.city}
                </div>
                <div className="font-mono text-sm text-white">
                  {selected}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelected(null);
              }}
              className="rounded border border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white/50 hover:border-white/30 hover:text-white shrink-0"
            >
              Clear
            </button>
          </div>
          <div className="px-4 py-2 text-[10px] text-white/50 border-b border-white/5 shrink-0">
            {connectedSymbols.size}{" "}
            {connectedSymbols.size === 1 ? "currency" : "currencies"} ·{" "}
            {selectedCorridors.length}{" "}
            {selectedCorridors.length === 1 ? "corridor" : "corridors"}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-wrap gap-1.5 content-start">
            {selectedCorridors.map((c) => {
              const other =
                c.source.symbol === selected ? c.dest : c.source;
              const coord = FIAT_COORDS[other.symbol];
              const statusTint =
                c.status === "GREEN"
                  ? "border-emerald-400/40 text-emerald-200"
                  : c.status === "AMBER"
                  ? "border-amber-400/40 text-amber-200"
                  : c.status === "RED"
                  ? "border-red-400/40 text-red-200"
                  : "border-white/15 text-white/70";
              return (
                <button
                  key={c.id}
                  type="button"
                  data-testid={`globe-conn-${c.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onCorridorClick) onCorridorClick(c.id);
                  }}
                  className={`flex items-center gap-1 rounded-full border bg-black/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition hover:bg-white/10 ${statusTint}`}
                  title={c.label}
                >
                  <span className="text-[11px] leading-none">
                    {coord?.flag ?? "🏳️"}
                  </span>
                  <span className="text-white/40">
                    {c.source.symbol === selected ? "→" : "←"}
                  </span>
                  <span>{other.symbol}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {label}
    </div>
  );
}
