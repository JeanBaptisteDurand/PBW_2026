import { Vector3 } from "three";
import type { EasingName } from "./sceneTypes";

type TransitionOptions = {
  fromPos: Vector3;
  toPos: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
  durationMs: number;
  easing: EasingName;
  onUpdate: (pos: Vector3, target: Vector3) => void;
  onComplete?: () => void;
};

const easingMap: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
};

export function animateCameraTransition(options: TransitionOptions) {
  const { fromPos, toPos, fromTarget, toTarget, durationMs, easing, onUpdate, onComplete } =
    options;

  if (durationMs <= 0) {
    onUpdate(toPos, toTarget);
    onComplete?.();
    return { stop: () => undefined };
  }

  const easingFn = easingMap[easing] ?? easingMap.linear;
  const start = performance.now();
  const originPos = fromPos.clone();
  const originTarget = fromTarget.clone();
  const destinationPos = toPos.clone();
  const destinationTarget = toTarget.clone();
  const tempPos = new Vector3();
  const tempTarget = new Vector3();

  let frameId = 0;
  let stopped = false;

  const step = (now: number) => {
    if (stopped) {
      return;
    }

    const elapsed = now - start;
    const t = Math.min(1, elapsed / durationMs);
    const eased = easingFn(t);

    tempPos.lerpVectors(originPos, destinationPos, eased);
    tempTarget.lerpVectors(originTarget, destinationTarget, eased);
    onUpdate(tempPos, tempTarget);

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
