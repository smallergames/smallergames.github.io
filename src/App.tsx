import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const LOADER_LETTERS = [
  { id: "w", label: "W" },
  { id: "i", label: "I" },
  { id: "p", label: "P" },
] as const;

const LOADER_SEQUENCE = ["w", "i-right", "p", "i-left"] as const;
type LoaderSequenceStep = (typeof LOADER_SEQUENCE)[number];
type LoaderLetterId = (typeof LOADER_LETTERS)[number]["id"];

const LOADER_MOTION = {
  swingAngle: 18,
  swingOffset: 7,
  centerNudge: 2.2,
  centerScale: 1.07,
  sideScale: 1.03,
};

type StepTiming = {
  stepMs: number;
  motionMs: number;
  glitchActive: boolean;
  glitchStutterPx: number;
  glitchOpacityDip: number;
  glitchChromaPx: number;
};
type BaseStepTiming = Pick<StepTiming, "stepMs" | "motionMs">;
type GlitchPatternState = {
  remainingRunSteps: number;
  runIntensity: number;
  cooldownSteps: number;
};
type TimingRoll = {
  stepTiming: StepTiming;
  nextPattern: GlitchPatternState;
};
type TimingControllerState = {
  stepTiming: StepTiming;
  glitchPattern: GlitchPatternState;
};

const NO_GLITCH = {
  glitchActive: false,
  glitchStutterPx: 0,
  glitchOpacityDip: 1,
  glitchChromaPx: 0,
} as const;

const BASE_STEP_TIMING: Record<LoaderSequenceStep, BaseStepTiming> = {
  w: { stepMs: 700, motionMs: 610 },
  "i-right": { stepMs: 350, motionMs: 275 },
  p: { stepMs: 700, motionMs: 610 },
  "i-left": { stepMs: 350, motionMs: 275 },
};

const TIMING_VARIANCE = {
  sideStepJitterMs: 68,
  sideMotionJitterMs: 52,
  centerStepJitterMs: 36,
  centerMotionJitterMs: 24,
};

const GLITCH = {
  chance: 0.52,
  minExtraPauseMs: 120,
  maxExtraPauseMs: 280,
  longHoldChance: 0.36,
  minLongHoldMs: 90,
  maxLongHoldMs: 380,
  motionStretchChance: 0.34,
  motionStretchRatio: 0.45,
  minRunSteps: 1,
  maxRunSteps: 4,
  extendChance: 0.24,
  maxExtendSteps: 2,
  minRunIntensity: 0.9,
  maxRunIntensity: 1.5,
  cooldownAfterRunChance: 0.48,
  minCooldownSteps: 1,
  maxCooldownSteps: 2,
  cooldownChanceMultiplier: 0.32,
  minStutterPx: 1.4,
  maxStutterPx: 2.8,
  minOpacityDip: 0.62,
  maxOpacityDip: 0.78,
  minChromaPx: 0.8,
  maxChromaPx: 1.6,
};

const PAUSE = {
  chance: 0.66,
  minMs: 70,
  maxMs: 210,
  longPauseChance: 0.24,
  minLongMs: 220,
  maxLongMs: 520,
  burstChance: 0.2,
  minBurstCount: 2,
  maxBurstCount: 4,
  minBurstMs: 35,
  maxBurstMs: 105,
  glitchBoostMultiplier: 1.2,
};

const SIDE_MOTION_TIMES = [0, 0.5, 1] as const;
const CENTER_MOTION_TIMES = [0, 0.36, 0.64, 1] as const;
const SIDE_GLITCH_MOTION_TIMES = [0, 0.46, 0.72, 0.82, 0.9, 1] as const;
const CENTER_GLITCH_MOTION_TIMES = [0, 0.32, 0.56, 0.72, 0.82, 0.9, 1] as const;
const SIDE_MOTION_EASE = [0.38, 0, 0.24, 1] as const;
const CENTER_MOTION_EASE = [0.2, 0.78, 0.24, 1] as const;
const GLITCH_MOTION_EASE = [0.18, 0.88, 0.22, 1] as const;
const LETTER_BASE_SHADOW = "0 0 14px rgba(255, 255, 255, 0.08)";
const INITIAL_GLITCH_PATTERN: GlitchPatternState = {
  remainingRunSteps: 0,
  runIntensity: 1,
  cooldownSteps: 0,
};

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD (strict order)
 *
 * loop start
 *  W animates
 *  I animates
 *  P animates
 *  I animates
 *  (timing jitters + occasional brief "stuck" hold)
 * loop end
 * ───────────────────────────────────────────────────────── */
const REST_ANIMATION = { rotate: 0, x: 0, scale: 1 };

const W_ACTIVE_ANIMATION = {
  rotate: [0, -LOADER_MOTION.swingAngle, 0],
  x: [0, -LOADER_MOTION.swingOffset, 0],
  scale: [1, LOADER_MOTION.sideScale, 1],
};

const I_RIGHT_ACTIVE_ANIMATION = {
  x: [0, LOADER_MOTION.centerNudge, -LOADER_MOTION.centerNudge * 0.34, 0],
  scale: [1, LOADER_MOTION.centerScale, 0.998, 1],
};

const P_ACTIVE_ANIMATION = {
  rotate: [0, LOADER_MOTION.swingAngle, 0],
  x: [0, LOADER_MOTION.swingOffset, 0],
  scale: [1, LOADER_MOTION.sideScale, 1],
};

const I_LEFT_ACTIVE_ANIMATION = {
  x: [0, -LOADER_MOTION.centerNudge, LOADER_MOTION.centerNudge * 0.34, 0],
  scale: [1, LOADER_MOTION.centerScale, 0.998, 1],
};

const REST_TRANSITION = {
  duration: 0.08,
  ease: "easeOut",
};

function getJitteredTiming(baseValue: number, jitterAmount: number) {
  return Math.round(baseValue + (Math.random() * 2 - 1) * jitterAmount);
}

function getRandomInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function getGlitchPauseMs() {
  return Math.round(
    GLITCH.minExtraPauseMs + Math.random() * (GLITCH.maxExtraPauseMs - GLITCH.minExtraPauseMs),
  );
}

function getLongHoldPauseMs() {
  return Math.round(
    GLITCH.minLongHoldMs + Math.random() * (GLITCH.maxLongHoldMs - GLITCH.minLongHoldMs),
  );
}

function getRandomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getChromaticSplitShadow(shiftPx: number) {
  return `${shiftPx}px 0 0 rgba(255, 66, 66, 0.64), ${-shiftPx}px 0 0 rgba(66, 225, 255, 0.64), ${LETTER_BASE_SHADOW}`;
}

function getInverseChromaticSplitShadow(shiftPx: number) {
  return `${-shiftPx}px 0 0 rgba(255, 66, 66, 0.64), ${shiftPx}px 0 0 rgba(66, 225, 255, 0.64), ${LETTER_BASE_SHADOW}`;
}

function getPauseMs(glitchActive: boolean) {
  let pauseMs = 0;

  if (Math.random() < PAUSE.chance) {
    pauseMs += getRandomInt(PAUSE.minMs, PAUSE.maxMs);
  }

  if (Math.random() < PAUSE.longPauseChance) {
    pauseMs += getRandomInt(PAUSE.minLongMs, PAUSE.maxLongMs);
  }

  if (Math.random() < PAUSE.burstChance) {
    const burstCount = getRandomInt(PAUSE.minBurstCount, PAUSE.maxBurstCount);
    for (let index = 0; index < burstCount; index += 1) {
      pauseMs += getRandomInt(PAUSE.minBurstMs, PAUSE.maxBurstMs);
    }
  }

  if (glitchActive) {
    pauseMs = Math.round(pauseMs * PAUSE.glitchBoostMultiplier);
  }

  return pauseMs;
}

function getStepTiming(step: LoaderSequenceStep, pattern: GlitchPatternState): TimingRoll {
  const base = BASE_STEP_TIMING[step];
  const isSide = step === "w" || step === "p";
  const stepJitterMs = isSide
    ? TIMING_VARIANCE.sideStepJitterMs
    : TIMING_VARIANCE.centerStepJitterMs;
  const motionJitterMs = isSide
    ? TIMING_VARIANCE.sideMotionJitterMs
    : TIMING_VARIANCE.centerMotionJitterMs;

  let stepMs = getJitteredTiming(base.stepMs, stepJitterMs);
  let motionMs = getJitteredTiming(base.motionMs, motionJitterMs);
  const nextPattern: GlitchPatternState = { ...pattern };
  let glitchActive = false;
  let glitchIntensity = 1;
  let glitchStutterPx = 0;
  let glitchOpacityDip = 1;
  let glitchChromaPx = 0;

  if (nextPattern.remainingRunSteps > 0) {
    glitchActive = true;
    glitchIntensity = nextPattern.runIntensity;
    nextPattern.remainingRunSteps -= 1;
  } else {
    const startChanceMultiplier =
      nextPattern.cooldownSteps > 0 ? GLITCH.cooldownChanceMultiplier : 1;
    const startChance = GLITCH.chance * startChanceMultiplier;

    if (Math.random() < startChance) {
      glitchActive = true;
      const runLength = getRandomInt(GLITCH.minRunSteps, GLITCH.maxRunSteps);
      glitchIntensity = getRandomBetween(GLITCH.minRunIntensity, GLITCH.maxRunIntensity);
      nextPattern.remainingRunSteps = runLength - 1;
      nextPattern.runIntensity = glitchIntensity;
      nextPattern.cooldownSteps = 0;
    } else {
      nextPattern.runIntensity = 1;
      if (nextPattern.cooldownSteps > 0) {
        nextPattern.cooldownSteps -= 1;
      }
    }
  }

  if (glitchActive) {
    if (Math.random() < GLITCH.extendChance) {
      nextPattern.remainingRunSteps += getRandomInt(1, GLITCH.maxExtendSteps);
    }

    const glitchPauseMs = Math.round(getGlitchPauseMs() * glitchIntensity);
    stepMs += glitchPauseMs;

    if (Math.random() < GLITCH.longHoldChance) {
      const longHoldMs = getLongHoldPauseMs();
      stepMs += longHoldMs;
      if (Math.random() < GLITCH.motionStretchChance) {
        motionMs += Math.round(longHoldMs * GLITCH.motionStretchRatio * 0.42);
      }
    }

    if (Math.random() < GLITCH.motionStretchChance) {
      motionMs += Math.round(glitchPauseMs * GLITCH.motionStretchRatio);
    }

    glitchStutterPx = getRandomBetween(GLITCH.minStutterPx, GLITCH.maxStutterPx) * glitchIntensity;
    glitchChromaPx = getRandomBetween(GLITCH.minChromaPx, GLITCH.maxChromaPx) * glitchIntensity;
    glitchOpacityDip = clamp(
      getRandomBetween(GLITCH.minOpacityDip, GLITCH.maxOpacityDip) - (glitchIntensity - 1) * 0.08,
      0.42,
      0.86,
    );

    if (nextPattern.remainingRunSteps === 0 && Math.random() < GLITCH.cooldownAfterRunChance) {
      nextPattern.cooldownSteps = getRandomInt(GLITCH.minCooldownSteps, GLITCH.maxCooldownSteps);
      nextPattern.runIntensity = 1;
    }
  }

  stepMs += getPauseMs(glitchActive);

  motionMs = Math.max(180, motionMs);
  stepMs = Math.max(motionMs + 56, stepMs);

  return {
    stepTiming: {
      stepMs,
      motionMs,
      glitchActive,
      glitchStutterPx,
      glitchOpacityDip,
      glitchChromaPx,
    },
    nextPattern,
  };
}

function getActiveTransition(step: LoaderSequenceStep, timing: StepTiming) {
  const duration = timing.motionMs / 1000;

  if (step === "w" || step === "p") {
    if (timing.glitchActive) {
      return {
        duration,
        ease: GLITCH_MOTION_EASE,
        times: SIDE_GLITCH_MOTION_TIMES,
      };
    }

    return {
      duration,
      ease: SIDE_MOTION_EASE,
      times: SIDE_MOTION_TIMES,
    };
  }

  if (timing.glitchActive) {
    return {
      duration,
      ease: GLITCH_MOTION_EASE,
      times: CENTER_GLITCH_MOTION_TIMES,
    };
  }

  return {
    duration,
    ease: CENTER_MOTION_EASE,
    times: CENTER_MOTION_TIMES,
  };
}

function getLetterMotion(step: LoaderSequenceStep, letterId: LoaderLetterId, timing: StepTiming) {
  const activeTransition = getActiveTransition(step, timing);

  if (letterId === "w" && step === "w") {
    if (timing.glitchActive) {
      return {
        animate: {
          rotate: [0, -LOADER_MOTION.swingAngle, 0, 0, 0, 0],
          x: [0, -LOADER_MOTION.swingOffset, 0, -timing.glitchStutterPx, timing.glitchStutterPx, 0],
          scale: [1, LOADER_MOTION.sideScale, 1, 1, 1, 1],
          opacity: [1, 1, 1, timing.glitchOpacityDip, 0.92, 1],
          textShadow: [
            LETTER_BASE_SHADOW,
            LETTER_BASE_SHADOW,
            LETTER_BASE_SHADOW,
            getChromaticSplitShadow(timing.glitchChromaPx),
            getInverseChromaticSplitShadow(timing.glitchChromaPx),
            LETTER_BASE_SHADOW,
          ],
        },
        transition: activeTransition,
      };
    }

    return { animate: W_ACTIVE_ANIMATION, transition: activeTransition };
  }

  if (letterId === "i" && step === "i-right") {
    if (timing.glitchActive) {
      return {
        animate: {
          x: [
            0,
            LOADER_MOTION.centerNudge,
            -LOADER_MOTION.centerNudge * 0.34,
            0,
            -timing.glitchStutterPx,
            timing.glitchStutterPx,
            0,
          ],
          scale: [1, LOADER_MOTION.centerScale, 0.998, 1, 1, 1, 1],
          opacity: [1, 1, 1, 1, timing.glitchOpacityDip, 0.92, 1],
          textShadow: [
            LETTER_BASE_SHADOW,
            LETTER_BASE_SHADOW,
            LETTER_BASE_SHADOW,
            LETTER_BASE_SHADOW,
            getChromaticSplitShadow(timing.glitchChromaPx),
            getInverseChromaticSplitShadow(timing.glitchChromaPx),
            LETTER_BASE_SHADOW,
          ],
        },
        transition: activeTransition,
      };
    }

    return { animate: I_RIGHT_ACTIVE_ANIMATION, transition: activeTransition };
  }

  if (letterId === "p" && step === "p") {
    if (timing.glitchActive) {
      return {
        animate: {
          rotate: [0, LOADER_MOTION.swingAngle, 0, 0, 0, 0],
          x: [0, LOADER_MOTION.swingOffset, 0, timing.glitchStutterPx, -timing.glitchStutterPx, 0],
          scale: [1, LOADER_MOTION.sideScale, 1, 1, 1, 1],
          opacity: [1, 1, 1, timing.glitchOpacityDip, 0.92, 1],
          textShadow: [
            LETTER_BASE_SHADOW,
            LETTER_BASE_SHADOW,
            LETTER_BASE_SHADOW,
            getChromaticSplitShadow(timing.glitchChromaPx),
            getInverseChromaticSplitShadow(timing.glitchChromaPx),
            LETTER_BASE_SHADOW,
          ],
        },
        transition: activeTransition,
      };
    }

    return { animate: P_ACTIVE_ANIMATION, transition: activeTransition };
  }

  if (letterId === "i" && step === "i-left") {
    if (timing.glitchActive) {
      return {
        animate: {
          x: [
            0,
            -LOADER_MOTION.centerNudge,
            LOADER_MOTION.centerNudge * 0.34,
            0,
            timing.glitchStutterPx,
            -timing.glitchStutterPx,
            0,
          ],
          scale: [1, LOADER_MOTION.centerScale, 0.998, 1, 1, 1, 1],
          opacity: [1, 1, 1, 1, timing.glitchOpacityDip, 0.92, 1],
          textShadow: [
            LETTER_BASE_SHADOW,
            LETTER_BASE_SHADOW,
            LETTER_BASE_SHADOW,
            LETTER_BASE_SHADOW,
            getChromaticSplitShadow(timing.glitchChromaPx),
            getInverseChromaticSplitShadow(timing.glitchChromaPx),
            LETTER_BASE_SHADOW,
          ],
        },
        transition: activeTransition,
      };
    }

    return { animate: I_LEFT_ACTIVE_ANIMATION, transition: activeTransition };
  }

  return { animate: REST_ANIMATION, transition: REST_TRANSITION };
}

function App() {
  const prefersReducedMotion = useReducedMotion();
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [timingController, setTimingController] = useState<TimingControllerState>(() => {
    const initialRoll = getStepTiming(LOADER_SEQUENCE[0], INITIAL_GLITCH_PATTERN);

    return {
      stepTiming: initialRoll.stepTiming,
      glitchPattern: initialRoll.nextPattern,
    };
  });
  const stepTiming = timingController.stepTiming;
  const currentStep = LOADER_SEQUENCE[sequenceIndex];

  useEffect(() => {
    if (prefersReducedMotion) {
      setSequenceIndex(0);
      setTimingController({
        stepTiming: { ...BASE_STEP_TIMING[LOADER_SEQUENCE[0]], ...NO_GLITCH },
        glitchPattern: INITIAL_GLITCH_PATTERN,
      });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSequenceIndex((index) => {
        const nextIndex = (index + 1) % LOADER_SEQUENCE.length;
        setTimingController((currentController) => {
          const nextRoll = getStepTiming(
            LOADER_SEQUENCE[nextIndex],
            currentController.glitchPattern,
          );

          return {
            stepTiming: nextRoll.stepTiming,
            glitchPattern: nextRoll.nextPattern,
          };
        });
        return nextIndex;
      });
    }, stepTiming.stepMs);

    return () => window.clearTimeout(timeoutId);
  }, [prefersReducedMotion, stepTiming.stepMs]);

  return (
    <main className="landing">
      <span className="landing-noise" aria-hidden="true" />

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

      <section className="landing-content">
        <p className="landing-tag">software - games - books - video - etc</p>
        <h1 className="landing-title">smallergames.com</h1>
        <p className="landing-description">building a modern appendix n.</p>
      </section>
    </main>
  );
}

export default App;
