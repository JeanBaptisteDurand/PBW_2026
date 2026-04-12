import defaultContent from "./defaultContent";
import type { LabelContent } from "../scene/sceneTypes";

const view4Title: LabelContent = {
  ...defaultContent,
  content: "Scroll down to continue",
  labelPlacement: {
    layer: "front",
    x: 0,
    y: 90,
  },
  labelMotion: {
    entrance: "bottom",
    exit: "top",
  },
  labelStyle: {
    variant: "outline",
    background: "transparent",
    borderColor: "transparent",
    shadowColor: "transparent",
    titleColor: "var(--landing-label-subtitle-default)",
    titleWeight: 500,
    titleSpacing: "0.06em",
    titleSize: "1.1rem",
    titleWidth: "100%",
    capsuleWidth: "100%",
    capsulePadding: "0",
    textAlign: "center",
    showTitle: true,
    showSubtitle: false,
    showBody: false,
    showScrollCue: true,
  },
};

export default view4Title;
