import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { getTextInkLeftInsetPx } from "../textMetrics";

type OpticalPadding = {
  tag: number;
  title: number;
  description: number;
};

const EPSILON = 0.05;

function hasMeaningfulDifference(current: OpticalPadding, next: OpticalPadding) {
  return (
    Math.abs(current.tag - next.tag) >= EPSILON ||
    Math.abs(current.title - next.title) >= EPSILON ||
    Math.abs(current.description - next.description) >= EPSILON
  );
}

export function useLandingTextAlignment() {
  const [titleLetterSpacingPx, setTitleLetterSpacingPx] = useState<number | null>(null);
  const [opticalPadding, setOpticalPadding] = useState<OpticalPadding>({
    tag: 0,
    title: 0,
    description: 0,
  });

  const tagRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  const syncOpticalLeftPadding = useCallback(() => {
    const tag = tagRef.current;
    const title = titleRef.current;
    const description = descriptionRef.current;

    if (!tag || !title || !description) {
      return;
    }

    const tagInset = getTextInkLeftInsetPx(tag.textContent ?? "", window.getComputedStyle(tag));
    const titleInset = getTextInkLeftInsetPx(
      title.textContent ?? "",
      window.getComputedStyle(title),
    );
    const descriptionInset = getTextInkLeftInsetPx(
      description.textContent ?? "",
      window.getComputedStyle(description),
    );
    const anchorInset = Math.max(tagInset, titleInset, descriptionInset);
    const nextPadding: OpticalPadding = {
      tag: Math.max(0, anchorInset - tagInset),
      title: Math.max(0, anchorInset - titleInset),
      description: Math.max(0, anchorInset - descriptionInset),
    };

    setOpticalPadding((current) => {
      if (!hasMeaningfulDifference(current, nextPadding)) {
        return current;
      }

      return nextPadding;
    });
  }, []);

  const syncTitleTracking = useCallback(() => {
    const tag = tagRef.current;
    const title = titleRef.current;
    const description = descriptionRef.current;

    if (!tag || !title || !description) {
      return;
    }

    const titleText = title.textContent ?? "";
    const gapCount = Math.max(Array.from(titleText).length - 1, 1);
    const tagRect = tag.getBoundingClientRect();
    const descriptionRect = description.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const targetRight = (tagRect.right + descriptionRect.right) / 2;
    const targetWidth = targetRight - titleRect.left;

    if (targetWidth <= 0) {
      return;
    }

    const computedStyle = window.getComputedStyle(title);
    const currentLetterSpacing = Number.parseFloat(computedStyle.letterSpacing);
    const resolvedLetterSpacing = Number.isFinite(currentLetterSpacing) ? currentLetterSpacing : 0;
    const nextLetterSpacing = resolvedLetterSpacing + (targetWidth - titleRect.width) / gapCount;

    if (!Number.isFinite(nextLetterSpacing)) {
      return;
    }

    setTitleLetterSpacingPx((current) => {
      if (current !== null && Math.abs(current - nextLetterSpacing) < EPSILON) {
        return current;
      }

      return nextLetterSpacing;
    });
  }, []);

  useLayoutEffect(() => {
    let rafId: number | null = null;
    let disposed = false;

    const scheduleSync = () => {
      if (disposed) {
        return;
      }

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        syncOpticalLeftPadding();
        syncTitleTracking();
      });
    };

    const handleFontLoadingDone = () => {
      scheduleSync();
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });

    if (tagRef.current) {
      resizeObserver.observe(tagRef.current);
    }

    if (titleRef.current) {
      resizeObserver.observe(titleRef.current);
    }

    if (descriptionRef.current) {
      resizeObserver.observe(descriptionRef.current);
    }

    window.addEventListener("resize", scheduleSync);
    document.fonts.addEventListener("loadingdone", handleFontLoadingDone);
    void document.fonts.ready.then(() => {
      scheduleSync();
    });
    scheduleSync();

    return () => {
      disposed = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleSync);
      document.fonts.removeEventListener("loadingdone", handleFontLoadingDone);
    };
  }, [syncOpticalLeftPadding, syncTitleTracking]);

  const tagStyle: CSSProperties | undefined =
    opticalPadding.tag < EPSILON ? undefined : { paddingLeft: `${opticalPadding.tag}px` };
  const descriptionStyle: CSSProperties | undefined =
    opticalPadding.description < EPSILON
      ? undefined
      : { paddingLeft: `${opticalPadding.description}px` };
  const titleStyle: CSSProperties | undefined =
    titleLetterSpacingPx === null && opticalPadding.title < EPSILON
      ? undefined
      : {
          ...(titleLetterSpacingPx === null ? {} : { letterSpacing: `${titleLetterSpacingPx}px` }),
          ...(opticalPadding.title < EPSILON ? {} : { paddingLeft: `${opticalPadding.title}px` }),
        };

  return {
    tagRef,
    titleRef,
    descriptionRef,
    tagStyle,
    titleStyle,
    descriptionStyle,
  };
}
