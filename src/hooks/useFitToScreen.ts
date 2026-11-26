"use client";

import { useEffect, useRef } from "react";

/**
 * Gives an element the whole height from where it starts to the bottom of the screen (keeping `bottom` free), on wide screens only (from the `lg` width up); on a narrow screen it
 * has no fixed height and grows with its content. Use it for a row of panels that should all be the same height and fit the screen. It is fitted again when the window changes size or
 * something above it appears or goes.
 */
export function useFitToScreen<T extends HTMLElement>(bottom = 32, min = 420) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const wide = matchMedia("(min-width: 1024px)");
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      el.style.height = wide.matches ? `${Math.max(min, window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - bottom)}px` : "";
    };
    fit();
    window.addEventListener("resize", fit);
    const watch = new ResizeObserver(fit);
    watch.observe(document.body);
    return () => (window.removeEventListener("resize", fit), watch.disconnect());
  }, [bottom, min]);
  return ref;
}
