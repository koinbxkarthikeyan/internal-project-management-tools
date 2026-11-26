"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A list that takes the room from where it starts to the bottom of the screen and scrolls inside itself when it is longer, so the page behind it never needs its own scroll.
 * `bottom` is what is kept free under it (the page's padding and the card around the list).
 */
export default function FitList({ className = "", bottom = 72, min = 160, children }: { className?: string; bottom?: number; min?: number; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (el) el.style.maxHeight = `${Math.max(min, window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - bottom)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    // The list can start lower or higher when something above it appears or goes (the filters, a message), so it is fitted again then.
    const watch = new ResizeObserver(fit);
    watch.observe(document.body);
    return () => (window.removeEventListener("resize", fit), watch.disconnect());
  }, [bottom, min]);
  return (
    <ul ref={ref} className={`overflow-y-auto overscroll-contain ${className}`}>
      {children}
    </ul>
  );
}
