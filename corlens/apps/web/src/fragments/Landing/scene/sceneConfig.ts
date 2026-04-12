import view1Title from "../content/view1Title";
import view1Title2 from "../content/view1Title2";
import view1Logo from "../content/view1Logo";
import view2Title from "../content/view2Title";
import view3ButtonHome from "../content/view3ButtonHome";
import view3ButtonAnalyze from "../content/view3ButtonAnalyze";
import view3ButtonCorridors from "../content/view3ButtonCorridors";
import view3FeaturesTitle from "../content/view3FeaturesTitle";
import view2FeaturesTitle from "../content/view2FeaturesTitle";
import view2BodyText from "../content/view2BodyText";
import view2Video from "../content/view2Video";
import view4Title from "../content/view4Title";
import viewLastDiscoverTitle from "../content/viewLastDiscoverTitle";
import type { SceneConfig } from "./sceneTypes";

const sceneConfig: SceneConfig = {
  background: "#05070f",
  renderer: {
    antialias: true,
    pixelRatioCap: 1.75,
  },
  camera: {
    fov: 34,
    near: 0.1,
    far: 200,
  },
  stage: {
    width: 1920,
    height: 1080,
  },
  model: {
    url: "/nero_and_seneca.glb",
    scale: 1,
    rotation: [0, 0, 0],
    position: [0, 0, 0],
    center: true,
  },
  lighting: {
    ambient: {
      color: "#3f2a69",
      intensity: 1.15,
    },
    key: {
      color: "#7ff2bf",
      intensity: 2.6,
      direction: [2.2, 3.4, 1.2],
    },
    presets: {
      lightScene: [0, 12, 28],
      lightLeftScene: [20, 12, 24],
      lightRightScene: [-20, 10, 24],
    },
  },
  transition: {
    durationMs: 1150,
    easing: "easeInOutCubic",
  },
  backgroundParticles: {
    enabled: true,
    count: 700,
    color: "#8f9dff",
    opacity: 0.45,
    size: 0.28,
    bounds: [52, 26, 50],
    center: [0, 4, -12],
    drift: {
      amplitude: 0.24,
      speed: 0.2,
    },
  },
  views: [
    // {
    //   contents: [view4Title],
    //   lightPreset: "lightScene",
    //   position: [9, 3, 20],
    //   target: [2, 4.8, 0],
    //   hideModel: false,
    // },
    {
      contents: [view1Title, view1Logo, view4Title],
      lightPreset: "lightScene",
      position: [5, 5, 10],
      target: [-4, 3.5, 0],
    },
    {
      contents: [view2FeaturesTitle, view2BodyText, view2Video],
      lightPreset: "lightScene",
      position: [5, 5, 10],
      target: [2, 3.5, 0],
    },
    {
      contents: [
        view3FeaturesTitle,
        view3ButtonHome,
        view3ButtonAnalyze,
        view3ButtonCorridors,
      ],
      lightPreset: "lightRightScene",
      position: [5, 5, 10],
      target: [7.2, 3.5, 0],
    },
    {
      contents: [viewLastDiscoverTitle],
      lightPreset: "lightScene",
      position: [9, 3, 20],
      target: [2, 4.8, 0],
      hideModel: false,
    },
  ],
};

export default sceneConfig;
