"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";

type Tip = { text: string; x: number; y: number };
type Pointer = Pick<ReactMouseEvent, "clientX" | "clientY">;

/**
 * A small tooltip that appears near the pointer after a short pause, for things that can't hold a `title` (rows and drop areas). `show` starts the
 * pause, `move` keeps the tip next to the pointer, `hide` closes it at once. Render `bubble` once next to the component that uses the hook.
 */
export function useHoverTip(delay = 450) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [shown, setShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setShown(false);
  }, []);
  const show = useCallback((text: string, e: Pointer) => {
    window.clearTimeout(timer.current);
    const at = { text, x: e.clientX, y: e.clientY };
    timer.current = window.setTimeout(() => {
      setTip(at);
      setShown(true);
    }, delay);
  }, [delay]);
  const move = useCallback((e: Pointer) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t)), []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { show, move, hide, bubble: tip ? <HoverTipBubble tip={tip} shown={shown} /> : null };
}

function HoverTipBubble({ tip, shown }: { tip: Tip; shown: boolean }) {
  // Next to the pointer, kept inside the window: it flips to the left of / above the pointer near the right and bottom edges.
  const width = 256;
  const left = tip.x + 14 + width > window.innerWidth - 8 ? Math.max(8, tip.x - 14 - width) : tip.x + 14;
  const below = tip.y + 16 + 60 < window.innerHeight;
  return createPortal(
    <div
      role="tooltip"
      style={{ left, top: below ? tip.y + 16 : undefined, bottom: below ? undefined : window.innerHeight - tip.y + 12, width: "max-content", maxWidth: width }}
      className={`pointer-events-none fixed z-[70] rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs leading-snug text-foreground shadow-md transition-opacity duration-150 ease-in-out motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
