import { useEffect, useState } from "react";
import type { RefObject } from "react";

export function useLandingContentReveal(
  contentRef: RefObject<HTMLElement>,
  prefersReducedMotion: boolean,
) {
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setContentReady(true);
      return;
    }

    void document.fonts.ready.then(() => {
      setContentReady(true);
    });
  }, [prefersReducedMotion]);

  useEffect(() => {
    const el = contentRef.current;

    if (!el || !contentReady) {
      return;
    }

    if (!prefersReducedMotion) {
      el.style.transition = "opacity 900ms ease-out, transform 900ms ease-out";
    }

    el.style.opacity = "1";
    el.style.transform = "translate3d(0, 0, 0)";
  }, [contentReady, contentRef, prefersReducedMotion]);
}
