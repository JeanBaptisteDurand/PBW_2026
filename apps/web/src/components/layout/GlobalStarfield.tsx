import { useEffect, useRef } from "react";
import viewConfig from "../../fragments/Landing/scene/sceneConfig";
import { createScene } from "../../fragments/Landing/scene/createScene";
import type { SceneConfig } from "../../fragments/Landing/scene/sceneTypes";

const config = viewConfig as SceneConfig;

export function GlobalStarfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const scene = createScene(canvas, config);
    const lastViewIndex = Math.max(0, config.views.length - 1);

    const applyLastView = () => {
      scene.resize();
      scene.setViewByIndex(lastViewIndex, { immediate: true });
    };

    const onResize = () => {
      applyLastView();
    };

    applyLastView();
    requestAnimationFrame(applyLastView);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      scene.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="global-starfield-canvas"
      aria-hidden="true"
    />
  );
}
