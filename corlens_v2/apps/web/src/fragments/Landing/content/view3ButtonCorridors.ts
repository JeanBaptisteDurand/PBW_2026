import type { LabelContent } from "../scene/sceneTypes";
import defaultContent from "./defaultContent";

const view3ButtonCorridors: LabelContent = {
  ...defaultContent,
  content: "Corridors",
  subtitle: "Map where liquidity actually moves.",
  body: "Monitor corridor health in real time, compare route quality by settlement type, and track actor-level reliability signals with clear context.",
  action: {
    to: "/corridors",
    ariaLabel: "Go to Corridors page",
  },
  labelPlacement: {
    layer: "front",
    x: 68,
    y: 42,
  },
  labelStyle: {
    ...defaultContent.labelStyle,
    variant: "glass",
    capsuleColor:
      "linear-gradient(145deg, rgba(243, 164, 62, 0.28), rgba(255, 189, 107, 0.22), rgba(24, 15, 7, 0.76))",
    borderColor: "rgba(255, 212, 148, 0.58)",
    shadowColor: "0 14px 30px rgba(171, 96, 21, 0.33)",
    titleColor: "#fff2db",
    subtitleColor: "rgba(255, 219, 166, 0.95)",
    bodyColor: "rgba(255, 238, 208, 0.94)",
    titleSize: "2.16rem",
    titleWeight: 760,
    titleSpacing: "0.03em",
    titleWidth: "100%",
    subtitleSize: "1.56rem",
    bodySize: "calc(var(--landing-font-size-md) * 1.4)",
    capsuleWidth: "29rem",
    capsuleHeight: "22rem",
    capsulePadding: "24px 28px 22px",
    textAlign: "right",
    showSubtitle: true,
    showBody: true,
  },
};

export default view3ButtonCorridors;
