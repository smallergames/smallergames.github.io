import { motion, useReducedMotion } from "framer-motion";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import { useLandingContentReveal } from "./home/hooks/useLandingContentReveal";
import { useLandingTextAlignment } from "./home/hooks/useLandingTextAlignment";
import { useLoaderSequence } from "./home/hooks/useLoaderSequence";
import { LOADER_LETTERS, REST_ANIMATION, REST_TRANSITION, getLetterMotion } from "./home/loader";

type AreaKey = "home" | "software" | "games" | "fiction" | "screenworks" | "etc";
type MenuKey = Exclude<AreaKey, "home">;

const HOME_PATH = "/";

const AREAS: Record<
  AreaKey,
  { label: string; path: string; subtitle: string; description: string }
> = {
  home: {
    label: "smallergames.com",
    path: HOME_PATH,
    subtitle: "a growing collection of odd + ends.",
    description: "software - games - fiction - screenworks - etc",
  },
  software: {
    label: "software",
    path: "/software",
    subtitle: "tools, experiments, little systems.",
    description: "west arm",
  },
  games: {
    label: "games",
    path: "/games",
    subtitle: "playable oddities and sharp corners.",
    description: "north arm",
  },
  fiction: {
    label: "fiction",
    path: "/fiction",
    subtitle: "text worlds and strange tales.",
    description: "east arm",
  },
  screenworks: {
    label: "screenworks",
    path: "/screenworks",
    subtitle: "moving image fragments and loops.",
    description: "south arm",
  },
  etc: {
    label: "etc",
    path: "/etc",
    subtitle: "miscellaneous fragments.",
    description: "miscellaneous branch",
  },
};

const MENU_ITEMS: Array<{ key: MenuKey; label: string }> = [
  { key: "software", label: "software" },
  { key: "games", label: "games" },
  { key: "fiction", label: "fiction" },
  { key: "screenworks", label: "screenworks" },
  { key: "etc", label: "etc" },
];

const POSITIONS: Record<AreaKey, { x: number; y: number }> = {
  home: { x: 0, y: 0 },
  software: { x: 1, y: 0 },
  games: { x: 2, y: 0 },
  fiction: { x: 3, y: 0 },
  screenworks: { x: 4, y: 0 },
  etc: { x: 5, y: 0 },
};

const AREA_PATHS = new Set(Object.values(AREAS).map((area) => area.path));
const BASE_TRANSITION = {
  duration: 0.7,
  ease: [0.2, 0.9, 0.12, 1] as const,
};

function areaFromPath(pathname: string): AreaKey {
  const matched = Object.entries(AREAS).find(([, area]) => area.path === pathname)?.[0];

  return (matched as AreaKey | undefined) ?? "home";
}

function viewFromPath(pathname: string): AreaKey {
  if (!AREA_PATHS.has(pathname)) {
    return "home";
  }

  return areaFromPath(pathname);
}

function App() {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const contentRef = useRef<HTMLElement>(null);
  const [view, setView] = useState<AreaKey>(() => viewFromPath(window.location.pathname));
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  const { currentStep, stepTiming } = useLoaderSequence(prefersReducedMotion);
  const { tagRef, titleRef, descriptionRef, tagStyle, titleStyle, descriptionStyle, isAligned } =
    useLandingTextAlignment(view === "home");

  useLandingContentReveal(contentRef, prefersReducedMotion);

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    document.title = `smallergames.com / ${view}`;
  }, [view]);

  useEffect(() => {
    const handlePopState = () => {
      setView(viewFromPath(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigateTo = useCallback((target: MenuKey) => {
    setView((current) => {
      if (current === target) {
        window.history.pushState({ area: "home" }, "", HOME_PATH);
        return "home";
      }

      const nextPath = AREAS[target].path;
      window.history.pushState({ area: target }, "", nextPath);

      return target;
    });
  }, []);

  const activeMenu = view;
  const cameraTarget = POSITIONS[view];
  const cameraTransform = {
    x: -cameraTarget.x * viewport.width,
    y: -cameraTarget.y * viewport.height,
  };

  return (
    <main className="landing">
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <span className="landing-noise" aria-hidden="true" />

      <motion.section
        className="route-stage"
        initial={false}
        animate={cameraTransform}
        transition={prefersReducedMotion ? { duration: 0 } : BASE_TRANSITION}
      >
        {(Object.keys(AREAS) as AreaKey[]).map((area) => {
          const position = POSITIONS[area];

          return (
            <section
              key={area}
              className={`route-screen route-screen-${area}`}
              style={{
                transform: `translate3d(${position.x * viewport.width}px, ${position.y * viewport.height}px, 0)`,
              }}
            >
              {area === "home" ? (
                <>
                  <section className="landing-loader" aria-label="Loading indicator">
                    <div className="loader-word" aria-hidden="true">
                      {LOADER_LETTERS.map((letter) => {
                        const motionConfig = prefersReducedMotion
                          ? { animate: REST_ANIMATION, transition: REST_TRANSITION }
                          : getLetterMotion(currentStep, letter.id, stepTiming);

                        return (
                          <motion.span
                            key={letter.id}
                            className={`loader-letter ${letter.id === "i" ? "loader-letter-center" : ""}`}
                            initial={false}
                            animate={motionConfig.animate}
                            transition={motionConfig.transition}
                          >
                            {letter.label}
                          </motion.span>
                        );
                      })}
                    </div>
                  </section>
                  <section
                    className={`landing-home-meta ${isAligned ? "landing-home-meta-ready" : ""}`}
                  >
                    <p
                      ref={descriptionRef}
                      className="landing-description"
                      style={descriptionStyle}
                    >
                      a growing collection of odd + ends.
                    </p>
                    <h1 ref={titleRef} className="landing-title" style={titleStyle}>
                      smallergames.com
                    </h1>
                  </section>
                </>
              ) : (
                <h2 className="route-screen-title">{AREAS[area].label}</h2>
              )}
            </section>
          );
        })}
      </motion.section>

      <section ref={contentRef} className="landing-content">
        <p ref={tagRef} className="landing-tag" style={tagStyle}>
          {MENU_ITEMS.map((item, index) => (
            <Fragment key={item.key}>
              <button
                type="button"
                className={`menu-link menu-link-inline ${activeMenu === item.key ? "menu-link-active" : ""}`}
                onClick={() => navigateTo(item.key)}
                aria-current={activeMenu === item.key ? "page" : undefined}
              >
                {item.label}
              </button>
              {index < MENU_ITEMS.length - 1 ? <span aria-hidden="true"> - </span> : null}
            </Fragment>
          ))}
        </p>
      </section>
    </main>
  );
}

export default App;
