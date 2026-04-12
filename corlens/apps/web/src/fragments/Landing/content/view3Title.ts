import defaultContent from "./defaultContent";
import type { LabelContent } from "../scene/sceneTypes";

const view3Title: LabelContent = {
  ...defaultContent,
  content: "Green Means Flow, Purple Means Signal",
  body: "This landing scene uses the same green and violet palette as the rest of Corlens for a seamless transition.",
  labelPlacement: {
    layer: "front",
    x: 60,
    y: 20,
  },
  labelStyle: {
    ...defaultContent.labelStyle,
    textAlign: "left",
  },
};

export default view3Title;
