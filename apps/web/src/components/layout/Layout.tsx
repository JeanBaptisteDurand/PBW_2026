import { useEffect, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { GlobalStarfield } from "./GlobalStarfield";
import { Navbar } from "./Navbar";

const ROUTE_TRANSITION_MS = 560;

export function Layout() {
  const location = useLocation();
  const outlet = useOutlet();
  const locationKey = `${location.pathname}${location.search}${location.hash}`;

  const [displayedOutlet, setDisplayedOutlet] = useState(outlet);
  const [displayedLocationKey, setDisplayedLocationKey] = useState(locationKey);
  const [displayedPathname, setDisplayedPathname] = useState(location.pathname);
  const [transitionStage, setTransitionStage] = useState<
    "idle" | "exit" | "enter"
  >("idle");

  useEffect(() => {
    if (locationKey === displayedLocationKey) {
      return;
    }

    setTransitionStage("exit");

    const timeoutId = window.setTimeout(() => {
      setDisplayedOutlet(outlet);
      setDisplayedLocationKey(locationKey);
      setDisplayedPathname(location.pathname);
      setTransitionStage("enter");
    }, ROUTE_TRANSITION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [displayedLocationKey, location.pathname, locationKey, outlet]);

  useEffect(() => {
    if (transitionStage !== "enter") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTransitionStage("idle");
    }, ROUTE_TRANSITION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [transitionStage]);

  const isLandingRoute =
    displayedPathname === "/landing" || displayedPathname === "/";
  const pageTheme = getPageTheme(displayedPathname);
  const layoutClassName = [
    "relative isolate min-h-screen overflow-x-hidden",
    isLandingRoute ? "bg-slate-950" : `app-theme app-theme-${pageTheme}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={layoutClassName} data-page-theme={pageTheme}>
      {!isLandingRoute && <GlobalStarfield />}
      {!isLandingRoute && (
        <div className="global-background-glass" aria-hidden="true" />
      )}
      {!isLandingRoute && <Navbar />}
      <main
        className={isLandingRoute ? "relative z-10" : "relative z-10 pt-14"}
      >
        <div
          className={[
            "route-transition",
            transitionStage === "idle"
              ? ""
              : `route-transition--${transitionStage}`,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {displayedOutlet}
        </div>
      </main>
    </div>
  );
}

function getPageTheme(pathname: string) {
  if (
    pathname.startsWith("/analyze") ||
    pathname.startsWith("/graph") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/compliance")
  ) {
    return "analyze";
  }

  if (pathname.startsWith("/corridors")) {
    return "corridors";
  }

  if (pathname.startsWith("/safe-path")) {
    return "safe-path";
  }

  if (pathname.startsWith("/premium")) {
    return "home";
  }

  return "home";
}
