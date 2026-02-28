import { useLayoutEffect, useRef, useState } from "react";
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

export function useLandingTextAlignment(enabled = true) {
  const [titleLetterSpacingPx, setTitleLetterSpacingPx] = useState<number | null>(null);
  const [opticalPadding, setOpticalPadding] = useState<OpticalPadding>({
    tag: 0,
    title: 0,
    description: 0,
  });
  const [isAligned, setIsAligned] = useState(false);

  const tagRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const hasInitializedRef = useRef(false);

  useLayoutEffect(() => {
    if (!enabled || hasInitializedRef.current) {
      return;
    }

    let rafId: number | null = null;
    let disposed = false;

    const measureOnce = () => {
      if (disposed || hasInitializedRef.current) {
        return;
      }

      const tag = tagRef.current;
      const title = titleRef.current;
      const description = descriptionRef.current;

      if (!tag || !title || !description) {
        rafId = window.requestAnimationFrame(measureOnce);
        return;
      }

      const tagRect = tag.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const isGeometryReady =
        tagRect.width > 0 &&
        descriptionRect.width > 0 &&
        titleRect.width > 0 &&
        titleRect.left >= 0 &&
        titleRect.right <= window.innerWidth + 1;

      if (!isGeometryReady) {
        rafId = window.requestAnimationFrame(measureOnce);
        return;
      }

      const titleText = title.textContent ?? "";
      const gapCount = Math.max(Array.from(titleText).length - 1, 1);
      const targetRight = (tagRect.right + descriptionRect.right) / 2;
      const targetWidth = targetRight - titleRect.left;

      if (targetWidth <= 0) {
        rafId = window.requestAnimationFrame(measureOnce);
        return;
      }

      const titleComputedStyle = window.getComputedStyle(title);
      const letterSpacingValue = Number.parseFloat(titleComputedStyle.letterSpacing);
      const baseLetterSpacing = Number.isFinite(letterSpacingValue) ? letterSpacingValue : 0;
      const nextLetterSpacing = baseLetterSpacing + (targetWidth - titleRect.width) / gapCount;

      if (!Number.isFinite(nextLetterSpacing)) {
        rafId = window.requestAnimationFrame(measureOnce);
        return;
      }

      setTitleLetterSpacingPx(nextLetterSpacing);

      const tagInset = getTextInkLeftInsetPx(tag.textContent ?? "", window.getComputedStyle(tag));
      const titleInset = getTextInkLeftInsetPx(title.textContent ?? "", titleComputedStyle);
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

      setOpticalPadding((current) =>
        hasMeaningfulDifference(current, nextPadding) ? nextPadding : current,
      );
      hasInitializedRef.current = true;
      setIsAligned(true);
    };

    const beginMeasurement = () => {
      if (disposed || hasInitializedRef.current) {
        return;
      }

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }

      rafId = window.requestAnimationFrame(measureOnce);
    };

    if (document.fonts.status === "loaded") {
      beginMeasurement();
    } else {
      void document.fonts.ready.then(() => {
        beginMeasurement();
      });
    }

    return () => {
      disposed = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [enabled]);

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
    isAligned,
  };
}
