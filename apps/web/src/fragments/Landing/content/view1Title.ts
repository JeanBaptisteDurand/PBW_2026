import defaultContent from "./defaultContent";
import type { LabelContent } from "../scene/sceneTypes";

const view1Title: LabelContent = {
  ...defaultContent,
  content: "WELCOME TO",
  labelPlacement: {
    layer: "behind",
    x: -2,
    y: 20,
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
    titleStrokeGradientFrom: "var(--token-colors-brand-500)",
    titleStrokeGradientTo: "var(--token-colors-brand-800)",
    titleStrokeWidth: 2,
    titleWeight: 1000,
    // titleScaleY: 2,
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

export default view1Title;
