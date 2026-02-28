import { useEffect, useState } from "react";

import {
  LOADER_SEQUENCE,
  type TimingControllerState,
  createInitialTimingController,
  getNextSequenceIndex,
  getNextTimingController,
  getReducedMotionTimingController,
} from "../loader";

export function useLoaderSequence(prefersReducedMotion: boolean) {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [timingController, setTimingController] = useState<TimingControllerState>(() =>
    createInitialTimingController(),
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setSequenceIndex(0);
      setTimingController(getReducedMotionTimingController());
      return;
    }

    const nextIndex = getNextSequenceIndex(sequenceIndex);
    const timeoutId = window.setTimeout(() => {
      setSequenceIndex(nextIndex);
      setTimingController((currentController) => {
        return getNextTimingController(LOADER_SEQUENCE[nextIndex], currentController.glitchPattern);
      });
    }, timingController.stepTiming.stepMs);

    return () => window.clearTimeout(timeoutId);
  }, [prefersReducedMotion, sequenceIndex, timingController.stepTiming.stepMs]);

  return {
    currentStep: LOADER_SEQUENCE[sequenceIndex],
    stepTiming: timingController.stepTiming,
  };
}
