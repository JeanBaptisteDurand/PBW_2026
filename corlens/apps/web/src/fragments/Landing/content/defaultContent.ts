import type { LabelContent } from "../scene/sceneTypes";

const defaultContent: LabelContent = {
  content: "",
  body: "",
  labelMotion: {
    entrance: "bottom",
    exit: "top",
  },
  labelPlacement: {
    layer: "front",
    x: 5,
    y: 24,
  },
  labelStyle: {
    variant: "outline",
    background: "var(--landing-label-capsule-bg-default)",
    borderColor: "var(--landing-label-border-strong)",
    shadowColor: "var(--landing-label-shadow-soft)",
    titleColor: "var(--landing-label-title-default)",
    subtitleColor: "var(--landing-label-subtitle-default)",
    bodyColor: "var(--landing-label-body-default)",
    titleSize: "var(--landing-font-size-xl)",
    subtitleSize: "var(--landing-font-size-md)",
    bodySize: "var(--landing-font-size-md)",
    capsuleWidth: "var(--landing-label-capsule-width-md)",
    capsulePadding: "var(--landing-label-capsule-padding-md)",
    textAlign: "left",
    showTitle: true,
    showSubtitle: true,
    showBody: true,
  },
};

export default defaultContent;
