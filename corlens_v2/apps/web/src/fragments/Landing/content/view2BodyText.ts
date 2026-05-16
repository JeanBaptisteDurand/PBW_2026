import type { LabelContent } from "../scene/sceneTypes";
import defaultContent from "./defaultContent";

const view2BodyText: LabelContent = {
  ...defaultContent,
  content: "",
  bodyHtml:
    'Corlens is a public intelligence layer for XRPL cross-border payments, designed to make settlement rails <strong class="landing-inline-gradient-cool">legible, auditable, and trustworthy</strong>. <br/><br/>It tracks <strong class="landing-inline-gradient-warm">2,436 live fiat corridors across 48 currencies</strong>, with real actors, route health, and liquidity signals in one atlas. <br/><br/>The Safe Path Agent and Entity Audit combine live risk checks, deep analysis, and RAG insights to deliver <strong class="landing-inline-gradient-cool">evidence-backed routing decisions</strong> and compliance-ready outputs.',
  labelPlacement: {
    layer: "front",
    x: 55,
    y: 42,
  },
  labelMotion: {
    entrance: "bottom",
    exit: "top",
  },
  labelStyle: {
    variant: "glass",
    background: "color-mix(in srgb, var(--token-colors-bg-primary) 36%, transparent)",
    borderColor: "var(--landing-label-border-strong)",
    shadowColor: "var(--landing-label-shadow-soft)",
    bodyColor: "var(--landing-label-body-default)",
    bodySize: "calc(var(--landing-font-size-md) * 1.4)",
    bodyWidth: "100%",
    capsuleWidth: "40%",
    capsuleHeight: "65vh",
    capsulePadding: "22px 28px",
    textAlign: "left",
    showTitle: false,
    showSubtitle: false,
    showBody: true,
  },
};

export default view2BodyText;
