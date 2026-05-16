import type { LabelContent } from "../scene/sceneTypes";
import defaultContent from "./defaultContent";

const view3ButtonAnalyze: LabelContent = {
  ...defaultContent,
  content: "Analyze",
  subtitle: "Deep analysis before moving capital.",
  body: "Launch graph-native entity audits, surface high-signal risk flags, and interrogate each result through grounded RAG insights.",
  action: {
    to: "/analyze",
    ariaLabel: "Go to Analyze page",
  },
  labelPlacement: {
    layer: "front",
    x: 36,
    y: 42,
  },
  labelStyle: {
    ...defaultContent.labelStyle,
    variant: "glass",
    capsuleColor:
      "linear-gradient(145deg, rgba(143, 123, 223, 0.28), rgba(108, 88, 183, 0.26), rgba(12, 15, 32, 0.78))",
    borderColor: "rgba(193, 182, 255, 0.56)",
    shadowColor: "0 14px 30px rgba(96, 78, 175, 0.34)",
    titleColor: "#e5e8ff",
    subtitleColor: "rgba(209, 201, 255, 0.96)",
    bodyColor: "rgba(228, 222, 255, 0.94)",
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

export default view3ButtonAnalyze;
