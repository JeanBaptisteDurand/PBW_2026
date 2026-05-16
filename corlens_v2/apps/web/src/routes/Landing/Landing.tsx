import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ContentOverlay } from "../../fragments/Landing/components/ContentOverlay";
import { ScrollSections } from "../../fragments/Landing/components/ScrollSections";
import { createScene } from "../../fragments/Landing/scene/createScene";
import viewConfig from "../../fragments/Landing/scene/sceneConfig";
import type { LabelContent, SceneConfig } from "../../fragments/Landing/scene/sceneTypes";
import { createScrollViewObserver } from "../../fragments/Landing/scene/scrollViews";
import "./landing.css";

const config = viewConfig as SceneConfig;
const EXIT_DURATION_MS = 420;

type DisplayedContent = {
  key: string;
  item: LabelContent;
  viewIndex: number;
  isExiting: boolean;
};

export default function Landing() {
  const routeRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasMounted = useRef(false);
  const hasCompleted = useRef(false);
  const navigate = useNavigate();

  const views = config.views;
  const [activeViewIndex, setActiveViewIndex] = useState(0);
  const [displayedContents, setDisplayedContents] = useState<DisplayedContent[]>(() =>
    buildDisplayEntries(views[0]?.contents ?? [], 0),
  );

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) {
      return;
    }

    scroll.scrollTop = 0;
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const route = routeRef.current;
    const canvas = canvasRef.current;
    const scroll = scrollRef.current;

    if (!route || !canvas || !scroll) {
      return;
    }

    const updateStageMetrics = () => {
      applyStageMetrics(route, config.stage);
    };

    const scene = createScene(canvas, config);
    const hasViews = views.length > 0;

    const resetToStart = () => {
      if (!hasViews) {
        return;
      }

      scroll.scrollTo({ top: 0, behavior: "auto" });
      scroll.scrollTop = 0;
      setActiveViewIndex(0);
      scene.resize();
      scene.setViewByIndex(0, { immediate: true });
    };

    const sections = Array.from(scroll.querySelectorAll<HTMLElement>("[data-view-index]"));

    const stopObserving = createScrollViewObserver(scroll, sections, (index) => {
      setActiveViewIndex(index);
      scene.setViewByIndex(index);
    });

    const handleResize = () => {
      updateStageMetrics();
      scene.resize();
    };

    const scheduleReset = () => {
      updateStageMetrics();
      resetToStart();
      requestAnimationFrame(resetToStart);
      window.setTimeout(resetToStart, 50);
    };

    const handlePageShow = () => {
      scheduleReset();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("pageshow", handlePageShow);
    scheduleReset();

    return () => {
      stopObserving();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pageshow", handlePageShow);
      scene.dispose();
    };
  }, [views]);

  const activeView = views[activeViewIndex] ?? views[0];

  useEffect(() => {
    const nextContents = activeView?.contents ?? [];

    if (!hasMounted.current) {
      hasMounted.current = true;
      setDisplayedContents(buildDisplayEntries(nextContents, activeViewIndex));
      return;
    }

    setDisplayedContents((prev) => {
      const exiting = prev.map((entry) => ({
        ...entry,
        key: `${entry.key}-exit-${Date.now()}`,
        isExiting: true,
      }));
      const entering = buildDisplayEntries(nextContents, activeViewIndex);
      return [...exiting, ...entering];
    });

    const timeoutId = window.setTimeout(() => {
      setDisplayedContents((prev) => prev.filter((entry) => !entry.isExiting));
    }, EXIT_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeView, activeViewIndex]);

  const handleComplete = useCallback(() => {
    if (hasCompleted.current) {
      return;
    }

    hasCompleted.current = true;
    navigate("/home", { replace: true });
  }, [navigate]);

  return (
    <div ref={routeRef} className="landing-route">
      <div className="landing-bg-atmosphere" aria-hidden="true" />
      <canvas ref={canvasRef} className="landing-scene-canvas" />
      {displayedContents.map((entry) => (
        <ContentOverlay
          key={entry.key}
          item={entry.item}
          viewIndex={entry.viewIndex}
          isExiting={entry.isExiting}
        />
      ))}
      <ScrollSections views={views} scrollRef={scrollRef} onComplete={handleComplete} />
    </div>
  );
}

function buildDisplayEntries(contents: LabelContent[], viewIndex: number) {
  return contents.map((item, index) => ({
    key: `view-${viewIndex}-content-${index}-${slugify(item.content)}`,
    item,
    viewIndex,
    isExiting: false,
  }));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function applyStageMetrics(route: HTMLElement, stage: SceneConfig["stage"] | undefined) {
  const referenceWidth = Math.max(1, stage?.width ?? window.innerWidth);
  const referenceHeight = Math.max(1, stage?.height ?? window.innerHeight);
  const scale = Math.max(window.innerWidth / referenceWidth, window.innerHeight / referenceHeight);
  const scaledWidth = referenceWidth * scale;
  const scaledHeight = referenceHeight * scale;
  const offsetX = (window.innerWidth - scaledWidth) * 0.5;
  const offsetY = (window.innerHeight - scaledHeight) * 0.5;
  const doubleScreenWidth = (window.innerWidth * 2) / scale;

  route.style.setProperty("--landing-stage-width", `${referenceWidth}px`);
  route.style.setProperty("--landing-stage-height", `${referenceHeight}px`);
  route.style.setProperty("--landing-stage-scale", String(scale));
  route.style.setProperty("--landing-stage-offset-x", `${offsetX}px`);
  route.style.setProperty("--landing-stage-offset-y", `${offsetY}px`);
  route.style.setProperty("--landing-double-screen-width", `${doubleScreenWidth}px`);
}
