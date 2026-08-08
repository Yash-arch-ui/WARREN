"use client";

import { useEffect, useState } from "react";

/**
 * useIsMobile - true once the viewport is below the Tailwind `md` breakpoint
 * (767px). Used to gate the landing/how-it-works GSAP pins + 3D device-zoom: on
 * mobile those scroll-jack and overflow horizontally, so the components fall
 * back to their static/stacked render (the same path reduced-motion takes).
 *
 * SSR-safe: returns `null` until measured on the client, so callers can avoid a
 * hydration mismatch by treating `null` as "undecided" (render the pre-measure
 * branch, like the existing `reduced === null` guards do).
 */
export function useIsMobile(maxWidth = 767): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [maxWidth]);

  return isMobile;
}
