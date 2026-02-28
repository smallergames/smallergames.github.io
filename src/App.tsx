import { motion, useReducedMotion } from "framer-motion";
import { useRef } from "react";

import { useLandingContentReveal } from "./home/hooks/useLandingContentReveal";
import { useLandingTextAlignment } from "./home/hooks/useLandingTextAlignment";
import { useLoaderSequence } from "./home/hooks/useLoaderSequence";
import { LOADER_LETTERS, REST_ANIMATION, REST_TRANSITION, getLetterMotion } from "./home/loader";

function App() {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const contentRef = useRef<HTMLElement>(null);

  const { currentStep, stepTiming } = useLoaderSequence(prefersReducedMotion);
  const { tagRef, titleRef, descriptionRef, tagStyle, titleStyle, descriptionStyle } = useLandingTextAlignment();

  useLandingContentReveal(contentRef, prefersReducedMotion);

  return (
    <main className="landing">
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>
      <span className="landing-noise" aria-hidden="true" />

      <section className="landing-loader" aria-label="Loading indicator">
        <div className="loader-word" aria-hidden="true">
          {LOADER_LETTERS.map((letter) => {
            const motionConfig = prefersReducedMotion ? { animate: REST_ANIMATION, transition: REST_TRANSITION } : getLetterMotion(currentStep, letter.id, stepTiming);

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

      <section ref={contentRef} className="landing-content">
        <p ref={tagRef} className="landing-tag" style={tagStyle}>
          software - games - books - screenworks - etc
        </p>
        <h1 ref={titleRef} className="landing-title" style={titleStyle}>
          smallergames.com
        </h1>
        <p ref={descriptionRef} className="landing-description" style={descriptionStyle}>
          tomorrow's collection of odd + ends.
        </p>
      </section>
    </main>
  );
}

export default App;
