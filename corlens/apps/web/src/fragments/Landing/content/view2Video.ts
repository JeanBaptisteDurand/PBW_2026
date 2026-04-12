import defaultContent from "./defaultContent";
import type { LabelContent } from "../scene/sceneTypes";

const view2Video: LabelContent = {
  ...defaultContent,
  content: "",
  labelPlacement: {
    layer: "front",
    x: 4,
    y: 42,
  },
  labelMotion: {
    entrance: "bottom",
    exit: "top",
  },
  media: {
    type: "video",
    src: "/test.mov",
    controls: false,
    autoPlay: true,
    loop: true,
    muted: true,
    playsInline: true,
  },
  labelStyle: {
    variant: "glass",
    background: "var(--landing-label-capsule-bg-default)",
    borderColor: "var(--landing-label-border-strong)",
    shadowColor: "var(--landing-label-shadow-soft)",
    mediaAspectRatio: "16 / 9",
    capsuleWidth: "50%",
    capsuleHeight: "65vh",
    capsulePadding: "12px",
    showTitle: false,
    showSubtitle: false,
    showBody: false,
  },
};

export default view2Video;
