import defaultContent from "./defaultContent";
import type { LabelContent } from "../scene/sceneTypes";

const view1Logo: LabelContent = {
  ...defaultContent,
  content: "CORLENS",
  labelPlacement: {
    layer: "front",
    x: -6,
    y: 38,
  },
  labelMotion: {
    entrance: "right",
    exit: "right",
  },
  labelStyle: {
    variant: "outline",
    background: "transparent",
    borderColor: "transparent",
    shadowColor: "transparent",
    titleColor: "var(--landing-label-title-default)",
    titleGradient:
      "linear-gradient(120deg, var(--token-colors-brand-500) 0%, var(--token-colors-brand-800) 100%)",
    titleOpacity: "0.8",
    titleWeight: 1000,
    titleSpacing: "-0.05em",
    titleWidth: "max-content",
    subtitleColor: "var(--landing-label-subtitle-default)",
    bodyColor: "var(--landing-label-body-default)",
    titleSize: "28rem",
    subtitleSize: "var(--landing-font-size-sm)",
    bodySize: "var(--landing-font-size-md)",
    capsuleWidth: "var(--landing-label-capsule-width-xl)",
    capsulePadding: "0",
    textAlign: "left",
    showTitle: true,
    showSubtitle: false,
    showBody: false,
  },
};

export default view1Logo;
