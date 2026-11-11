"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

type KindTabsProps = {
  /** Every team that can be picked, shown left to right in one row. */
  kinds: readonly string[];
  value: string | null;
  onChange: (kind: string) => void;
  invalid?: boolean;
  /** The tabs can't be picked yet (nothing to log time against); the row can still be scrolled to look. */
  disabled?: boolean;
};

const arrow =
  "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-md transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent";

/**
 * The Kind of work tabs: one row that uses the whole width (the tabs share it when they fit) and scrolls sideways when there are more teams than
 * room, with arrows that appear only on the side that has more. The picked tab is brought into view, so no team is ever out of reach.
 */
export default function KindTabs({ kinds, value, onChange, invalid = false, disabled = false }: KindTabsProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const smooth = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

  const measure = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, kinds.length]);

  // The picked tab is centred in the row (only the row scrolls, never the page).
  useEffect(() => {
    const el = rowRef.current;
    const tab = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !tab) return;
    el.scrollTo({ left: tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2, behavior: smooth() });
  }, [value]);

  const page = (dir: -1 | 1) => rowRef.current?.scrollBy({ left: dir * Math.max(120, (rowRef.current?.clientWidth ?? 0) * 0.7), behavior: smooth() });

  return (
    <div className={`relative rounded-xl border bg-background ${invalid ? "border-red-500" : "border-border"}`}>
      {edges.left && (
        <button type="button" aria-label="Scroll teams left" onClick={() => page(-1)} className={`${arrow} left-1`}>
          <ChevronLeftIcon />
        </button>
      )}
      <div
        ref={rowRef}
        role="group"
        aria-label="Kind of work"
        onScroll={measure}
        className="relative flex gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            disabled={disabled}
            onClick={() => onChange(k)}
            className={`min-w-fit disabled:cursor-not-allowed disabled:opacity-60 flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              value === k ? "bg-accent-soft font-medium text-accent" : "text-muted enabled:hover:bg-hover enabled:hover:text-foreground"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      {edges.right && (
        <button type="button" aria-label="Scroll teams right" onClick={() => page(1)} className={`${arrow} right-1`}>
          <ChevronRightIcon />
        </button>
      )}
    </div>
  );
}
