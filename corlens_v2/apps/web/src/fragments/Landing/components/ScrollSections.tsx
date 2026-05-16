import { useEffect } from "react";
import type { RefObject } from "react";
import type { Viewpoint } from "../scene/sceneTypes";

type ScrollSectionsProps = {
  views: Viewpoint[];
  scrollRef: RefObject<HTMLDivElement>;
  onComplete?: () => void;
};

export function ScrollSections({ views, scrollRef, onComplete }: ScrollSectionsProps) {
  useEffect(() => {
    const scrollNode = scrollRef.current;
    if (!scrollNode || !onComplete) {
      return;
    }

    const completeNode = scrollNode.querySelector<HTMLElement>("[data-landing-complete='true']");

    if (!completeNode) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onComplete();
        }
      },
      {
        root: scrollNode,
        threshold: 0.65,
      },
    );

    observer.observe(completeNode);

    return () => observer.disconnect();
  }, [onComplete, scrollRef]);

  return (
    <div ref={scrollRef} className="landing-scroll" aria-label="Landing sections">
      {views.map((_, index) => (
        <section
          // biome-ignore lint/suspicious/noArrayIndexKey: config-driven array, never reorders; index doubles as IntersectionObserver target id.
          key={`view-${index}`}
          className="landing-scroll-section"
          data-view-index={index}
          aria-hidden="true"
        />
      ))}
      <section
        className="landing-scroll-section landing-scroll-section--complete"
        data-landing-complete="true"
        aria-hidden="true"
      />
    </div>
  );
}
