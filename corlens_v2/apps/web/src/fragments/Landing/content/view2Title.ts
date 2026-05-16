import type { LabelContent } from "../scene/sceneTypes";
import defaultContent from "./defaultContent";

const view2Title: LabelContent = {
  ...defaultContent,
  content: "Visual Intelligence For XRP Corridors",
  body: "Rotate through corridor states, liquidity pressure, and risk patterns before entering the dashboard.",
  labelPlacement: {
    layer: "front",
    x: 8,
    y: 17,
  },
};

export default view2Title;
