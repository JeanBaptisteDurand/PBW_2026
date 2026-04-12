import defaultContent from "./defaultContent";
import type { LabelContent } from "../scene/sceneTypes";

const view3FeaturesTitle: LabelContent = {
  ...defaultContent,
  content: "FEATURES",
  labelPlacement: {
    layer: "behind",
    x: 0,
    y: 5,
  },
  labelMotion: {
    entrance: "top",
    exit: "top",
  },
  labelStyle: {
    variant: "outline",
    background: "transparent",
    borderColor: "transparent",
    shadowColor: "transparent",
    titleColor: "var(--landing-label-title-default)",
    titleGradient:
      "linear-gradient(120deg, var(--token-colors-brand-500) 0%, var(--token-colors-brand-800) 100%)",
    titleWeight: 1000,
    titleSpacing: "-0.09em",
    titleWidth: "max-content",
    subtitleColor: "var(--landing-label-subtitle-default)",
    bodyColor: "var(--landing-label-body-default)",
    titleSize: "20rem",
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

export default view3FeaturesTitle;
