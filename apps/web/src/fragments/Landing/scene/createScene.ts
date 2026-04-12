import {
  AdditiveBlending,
  AmbientLight,
  Box3,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Object3D,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { EasingName, SceneConfig, Viewpoint } from "./sceneTypes";
import { animateCameraTransition } from "./cameraTransition";

export function createScene(canvas: HTMLCanvasElement, config: SceneConfig) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: config.renderer.antialias,
    powerPreference: "high-performance",
    alpha: true,
  });

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(new Color(config.background), 0);

  const scene = new Scene();

  const camera = new PerspectiveCamera(
    config.camera.fov,
    1,
    config.camera.near,
    config.camera.far,
  );

  const ambient = new AmbientLight(
    config.lighting.ambient.color,
    config.lighting.ambient.intensity,
  );
  const keyLight = new DirectionalLight(
    config.lighting.key.color,
    config.lighting.key.intensity,
  );
  keyLight.position.set(...config.lighting.key.direction);

  scene.add(ambient, keyLight);

  const starfield = config.backgroundParticles?.enabled
    ? createStarfield(config.backgroundParticles)
    : null;

  if (starfield) {
    scene.add(starfield.points);
  }

  const rig = {
    position: new Vector3(),
    target: new Vector3(),
  };

  let model: Object3D | null = null;
  let pendingModelVisible: boolean | null = null;
  let activeTransition: { stop: () => void } | null = null;
  let activeLightTransition: { stop: () => void } | null = null;
  let activeRenderLoop = 0;
  let currentIndex = -1;
  const stageAspect = resolveStageAspect(config);

  const renderFrame = () => {
    if (starfield) {
      updateStarfield(starfield, performance.now() * 0.001);
    }
    camera.position.copy(rig.position);
    camera.lookAt(rig.target);
    renderer.render(scene, camera);
  };

  const startRenderLoop = () => {
    if (activeRenderLoop) {
      return;
    }

    const loop = () => {
      renderFrame();
      activeRenderLoop = requestAnimationFrame(loop);
    };

    activeRenderLoop = requestAnimationFrame(loop);
  };

  const stopRenderLoop = () => {
    if (activeRenderLoop) {
      cancelAnimationFrame(activeRenderLoop);
      activeRenderLoop = 0;
    }
  };

  const resolveLightDirection = (view: Viewpoint) => {
    const preset = view.lightPreset;
    const presetDirection = preset ? config.lighting.presets?.[preset] : null;
    return presetDirection ?? config.lighting.key.direction;
  };

  const setLightImmediate = (view: Viewpoint) => {
    const direction = resolveLightDirection(view);
    keyLight.position.set(...direction);
  };

  const resolveModelVisibility = (view: Viewpoint) => !view.hideModel;

  const applyModelVisibility = (view: Viewpoint) => {
    const visible = resolveModelVisibility(view);
    if (model) {
      model.visible = visible;
      renderFrame();
      return;
    }
    pendingModelVisible = visible;
  };

  const animateLight = (view: Viewpoint) => {
    const direction = resolveLightDirection(view);
    activeLightTransition?.stop();
    activeLightTransition = animateVectorTransition({
      from: keyLight.position.clone(),
      to: new Vector3(...direction),
      durationMs: config.transition.durationMs,
      easing: config.transition.easing,
      onUpdate: (pos) => {
        keyLight.position.copy(pos);
        renderFrame();
      },
      onComplete: () => {
        activeLightTransition = null;
      },
    });
  };

  const applyView = (view: Viewpoint) => {
    rig.position.set(...view.position);
    rig.target.set(...view.target);
  };

  const setViewByIndex = (index: number, options?: { immediate?: boolean }) => {
    const view = config.views[index];

    if (!view || index === currentIndex) {
      return;
    }

    applyModelVisibility(view);

    activeTransition?.stop();
    activeTransition = null;

    if (options?.immediate) {
      setLightImmediate(view);
      applyView(view);
      renderFrame();
      currentIndex = index;
      return;
    }

    animateLight(view);

    const fromPos = rig.position.clone();
    const fromTarget = rig.target.clone();
    const toPos = new Vector3(...view.position);
    const toTarget = new Vector3(...view.target);

    activeTransition = animateCameraTransition({
      fromPos,
      toPos,
      fromTarget,
      toTarget,
      durationMs: config.transition.durationMs,
      easing: config.transition.easing,
      onUpdate: (pos, target) => {
        rig.position.copy(pos);
        rig.target.copy(target);
        renderFrame();
      },
      onComplete: () => {
        currentIndex = index;
        activeTransition = null;
      },
    });
  };

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;

    if (!clientWidth || !clientHeight) {
      return;
    }

    const viewport = getCoveredViewport(clientWidth, clientHeight, stageAspect);

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, config.renderer.pixelRatioCap),
    );
    renderer.setSize(clientWidth, clientHeight, false);
    renderer.setViewport(
      viewport.x,
      viewport.y,
      viewport.width,
      viewport.height,
    );
    renderer.setScissor(0, 0, clientWidth, clientHeight);
    renderer.setScissorTest(true);
    camera.aspect = stageAspect;
    camera.updateProjectionMatrix();
    renderFrame();
  };

  const dispose = () => {
    activeTransition?.stop();
    activeLightTransition?.stop();
    stopRenderLoop();

    if (starfield) {
      starfield.geometry.dispose();
      starfield.material.dispose();
      scene.remove(starfield.points);
    }

    renderer.setScissorTest(false);
    renderer.dispose();
  };

  const loader = new GLTFLoader();
  loader.load(
    config.model.url,
    (gltf) => {
      const loadedModel = gltf.scene;
      model = loadedModel;

      if (config.model.center) {
        const box = new Box3().setFromObject(loadedModel);
        const center = box.getCenter(new Vector3());
        loadedModel.position.sub(center);
      }

      applyModelTransform(loadedModel, config.model);
      if (pendingModelVisible !== null) {
        loadedModel.visible = pendingModelVisible;
      }
      scene.add(loadedModel);
      renderFrame();
    },
    undefined,
    () => {
      renderFrame();
    },
  );

  if (starfield) {
    startRenderLoop();
  }

  return {
    setViewByIndex,
    resize,
    dispose,
  };
}

function createStarfield(config: {
  count: number;
  color: string;
  opacity: number;
  size: number;
  bounds: [number, number, number];
  center: [number, number, number];
  drift: { amplitude: number; speed: number };
}) {
  const count = Math.max(0, Math.floor(config.count));
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const baseIndex = i * 3;
    const x = config.center[0] + (Math.random() - 0.5) * config.bounds[0];
    const y = config.center[1] + (Math.random() - 0.5) * config.bounds[1];
    const z = config.center[2] + (Math.random() - 0.5) * config.bounds[2];

    base[baseIndex] = x;
    base[baseIndex + 1] = y;
    base[baseIndex + 2] = z;

    positions[baseIndex] = x;
    positions[baseIndex + 1] = y;
    positions[baseIndex + 2] = z;

    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = config.drift.speed * (0.5 + Math.random());
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  const texture = createCircleTexture();
  const material = new PointsMaterial({
    color: config.color,
    size: config.size,
    sizeAttenuation: true,
    transparent: true,
    opacity: config.opacity,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  if (texture) {
    material.map = texture;
    material.alphaTest = 0.02;
  }

  const points = new Points(geometry, material);
  points.frustumCulled = false;

  return {
    points,
    geometry,
    material,
    positions,
    base,
    phases,
    speeds,
    drift: config.drift,
  };
}

function createCircleTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const center = size / 2;
  const radius = size * 0.45;

  const gradient = ctx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    radius,
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function updateStarfield(
  starfield: {
    geometry: BufferGeometry;
    positions: Float32Array;
    base: Float32Array;
    phases: Float32Array;
    speeds: Float32Array;
    drift: { amplitude: number; speed: number };
  },
  time: number,
) {
  const { positions, base, phases, speeds, drift } = starfield;
  const amplitude = drift.amplitude;

  for (let i = 0; i < phases.length; i += 1) {
    const baseIndex = i * 3;
    const offset = Math.sin(time * speeds[i] + phases[i]) * amplitude;
    const offsetY = Math.cos(time * speeds[i] + phases[i]) * amplitude;

    positions[baseIndex] = base[baseIndex] + offset;
    positions[baseIndex + 1] = base[baseIndex + 1] + offsetY;
    positions[baseIndex + 2] = base[baseIndex + 2];
  }

  starfield.geometry.attributes.position.needsUpdate = true;
}

function animateVectorTransition(options: {
  from: Vector3;
  to: Vector3;
  durationMs: number;
  easing: EasingName;
  onUpdate: (pos: Vector3) => void;
  onComplete?: () => void;
}) {
  const { from, to, durationMs, easing, onUpdate, onComplete } = options;

  if (durationMs <= 0) {
    onUpdate(to);
    onComplete?.();
    return { stop: () => undefined };
  }

  const easingMap: Record<EasingName, (t: number) => number> = {
    linear: (t) => t,
    easeInOutCubic: (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  };

  const easingFn = easingMap[easing] ?? easingMap.linear;
  const start = performance.now();
  const origin = from.clone();
  const destination = to.clone();
  const temp = new Vector3();

  let frameId = 0;
  let stopped = false;

  const step = (now: number) => {
    if (stopped) {
      return;
    }

    const elapsed = now - start;
    const t = Math.min(1, elapsed / durationMs);
    const eased = easingFn(t);

    temp.lerpVectors(origin, destination, eased);
    onUpdate(temp);

    if (t < 1) {
      frameId = requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  };

  frameId = requestAnimationFrame(step);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(frameId);
    },
  };
}

function applyModelTransform(model: Object3D, config: SceneConfig["model"]) {
  const rotation = config.rotation;
  const offset = config.position;

  if (Array.isArray(config.scale)) {
    model.scale.set(config.scale[0], config.scale[1], config.scale[2]);
  } else {
    model.scale.setScalar(config.scale);
  }

  model.rotation.set(rotation[0], rotation[1], rotation[2]);
  model.position.add(new Vector3(offset[0], offset[1], offset[2]));
}

function resolveStageAspect(config: SceneConfig) {
  const width = config.stage?.width;
  const height = config.stage?.height;

  if (!width || !height) {
    return 16 / 9;
  }

  return width / height;
}

function getCoveredViewport(
  containerWidth: number,
  containerHeight: number,
  targetAspect: number,
) {
  const containerAspect = containerWidth / containerHeight;

  if (containerAspect > targetAspect) {
    const width = containerWidth;
    const height = Math.round(width / targetAspect);
    const y = Math.floor((containerHeight - height) / 2);
    return { x: 0, y, width, height };
  }

  const height = containerHeight;
  const width = Math.round(height * targetAspect);
  const x = Math.floor((containerWidth - width) / 2);
  return { x, y: 0, width, height };
}
