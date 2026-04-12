import defaultContent from "./defaultContent";
import type { LabelContent } from "../scene/sceneTypes";

const view3ButtonHome: LabelContent = {
  ...defaultContent,
  content: "Safe Path AI Agent",
  subtitle: "Route capital safely using AI.",
  body: "Resolve corridors instantly, run deep risk checks, launch real entity audits, and return evidence-backed routing with split-path and compliance-ready outputs.",
  action: {
    to: "/safe-path",
    ariaLabel: "Go to Safe Path page",
  },
  labelPlacement: {
    layer: "front",
    x: 4,
    y: 42,
  },
  labelStyle: {
    ...defaultContent.labelStyle,
    variant: "glass",
    capsuleColor:
      "linear-gradient(145deg, rgba(61, 207, 124, 0.28), rgba(114, 230, 160, 0.24), rgba(9, 20, 13, 0.78))",
    borderColor: "rgba(159, 243, 188, 0.58)",
    shadowColor: "0 14px 30px rgba(31, 122, 72, 0.33)",
    titleColor: "#e9ffef",
    subtitleColor: "rgba(189, 255, 213, 0.96)",
    bodyColor: "rgba(221, 248, 230, 0.95)",
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

export default view3ButtonHome;
