export type Vec3 = [number, number, number];

export type EasingName = "linear" | "easeInOutCubic" | "easeOutCubic";

export type LabelLayer = "front" | "behind";

export type LabelPlacement = {
  layer: LabelLayer;
  x: number;
  y: number;
};

export type LabelStyleVariant = "glass" | "solid" | "outline";

export type LabelStyle = {
  variant?: LabelStyleVariant;
  background?: string;
  capsuleColor?: string;
  capsuleWidth?: number | string;
  capsuleHeight?: number | string;
  capsulePadding?: number | string;
  borderColor?: string;
  textColor?: string;
  bodyColor?: string;
  titleColor?: string;
  titleGradient?: string;
  titleOpacity?: number | string;
  titleTextShadow?: string;
  titleStrokeColor?: string;
  titleStrokeWidth?: number | string;
  titleStrokeGradientFrom?: string;
  titleStrokeGradientTo?: string;
  titleWeight?: number | string;
  titleWidth?: number | string;
  titleHeight?: number | string;
  titleScaleY?: number | string;
  titleSpacing?: number | string;
  tagColor?: string;
  subtitleColor?: string;
  shadowColor?: string;
  maxWidth?: number | string;
  titleSize?: number | string;
  subtitleSize?: number | string;
  bodySize?: number | string;
  bodyWidth?: number | string;
  mediaAspectRatio?: number | string;
  textAlign?: "left" | "center" | "right";
  showTitle?: boolean;
  showSubtitle?: boolean;
  showBody?: boolean;
  showScrollCue?: boolean;
};

export type LabelMediaVideo = {
  type: "video";
  src: string;
  poster?: string;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
};

export type LabelMedia = LabelMediaVideo;

export type LabelMotionDirection = "none" | "top" | "bottom" | "left" | "right";

export type LabelMotion = {
  entrance?: LabelMotionDirection;
  exit?: LabelMotionDirection;
};

export type LabelContent = {
  content: string;
  subtitle?: string;
  body?: string;
  bodyHtml?: string;
  media?: LabelMedia;
  action?: {
    to: string;
    ariaLabel?: string;
  };
  labelMotion?: LabelMotion;
  labelPlacement?: LabelPlacement;
  labelStyle?: LabelStyle;
};

export type LightPresetName = "lightScene" | "lightLeftScene" | "lightRightScene";

export type Viewpoint = {
  contents: LabelContent[];
  header?: boolean;
  mode?: "scene" | "longform";
  navLabel?: string;
  hideModel?: boolean;
  lightPreset?: LightPresetName;
  position: Vec3;
  target: Vec3;
};

export type LightingConfig = {
  ambient: {
    color: string;
    intensity: number;
  };
  key: {
    color: string;
    intensity: number;
    direction: Vec3;
  };
  presets?: Record<LightPresetName, Vec3>;
};

export type BackgroundParticlesConfig = {
  enabled: boolean;
  count: number;
  color: string;
  opacity: number;
  size: number;
  bounds: Vec3;
  center: Vec3;
  drift: {
    amplitude: number;
    speed: number;
  };
};

export type TransitionConfig = {
  durationMs: number;
  easing: EasingName;
};

export type ModelConfig = {
  url: string;
  position: Vec3;
  rotation: Vec3;
  scale: number | Vec3;
  center: boolean;
};

export type RendererConfig = {
  pixelRatioCap: number;
  antialias: boolean;
};

export type CameraConfig = {
  fov: number;
  near: number;
  far: number;
};

export type StageConfig = {
  width: number;
  height: number;
};

export type SceneConfig = {
  background: string;
  renderer: RendererConfig;
  camera: CameraConfig;
  stage?: StageConfig;
  model: ModelConfig;
  lighting: LightingConfig;
  transition: TransitionConfig;
  backgroundParticles?: BackgroundParticlesConfig;
  views: Viewpoint[];
};
