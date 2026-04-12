import defaultContent from "./defaultContent";
import type { LabelContent } from "../scene/sceneTypes";

const view1Title2: LabelContent = {
  ...defaultContent,
  content: "TO",
  labelPlacement: {
    layer: "behind",
    x: -5,
    y: 51,
  },
  labelMotion: {
    entrance: "bottom",
    exit: "bottom",
  },
  labelStyle: {
    titleScaleY: 1.6,
    variant: "outline",
    background: "transparent",
    borderColor: "transparent",
    shadowColor: "transparent",
    titleColor: "var(--token-colors-text-primary)",
    titleWeight: 1000,
    titleSpacing: "-0.10em",
    titleWidth: "max-content",
    subtitleColor: "var(--landing-label-subtitle-default)",
    bodyColor: "var(--landing-label-body-default)",
    titleSize: "27rem",
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

export default view1Title2;
