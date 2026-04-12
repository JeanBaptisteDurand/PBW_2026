export function createScrollViewObserver(
  container: HTMLElement,
  sections: HTMLElement[],
  onViewChange: (index: number) => void,
) {
  if (!container || sections.length === 0) {
    return () => undefined;
  }

  let activeIndex = -1;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const target = entry.target as HTMLElement;
        const index = Number(target.dataset.viewIndex);

        if (Number.isNaN(index) || index === activeIndex) {
          return;
        }

        activeIndex = index;
        onViewChange(index);
      });
    },
    {
      root: container,
      threshold: 0,
      rootMargin: "-45% 0px -45% 0px",
    },
  );

  sections.forEach((section) => observer.observe(section));

  return () => observer.disconnect();
}
