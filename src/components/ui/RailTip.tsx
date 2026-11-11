"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSidebarStore } from "@/stores/sidebarStore";

type Rect = { left: number; right: number; top: number; bottom: number };

/**
 * A tooltip for the icon-only sidebar: it names the item beside its icon (`side="right"`) or under it (`side="bottom"`). It appears smoothly on hover
 * and stays while the pointer is over the icon or the tip. By default it only works while the desktop sidebar is collapsed (the labels are visible
 * otherwise); `always` keeps it on in both states. It never opens or expands anything.
 */
export default function RailTip({
  label,
  side = "right",
  always = false,
  off = false,
  className = "",
  children,
}: {
  label: string;
  side?: "right" | "bottom";
  always?: boolean;
  off?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const host = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [rect, setRect] = useState<Rect | null>(null);
  const [shown, setShown] = useState(false);
  const hovering = useRef(false);

  const close = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown(false), 90);
    window.setTimeout(() => !hovering.current && setRect(null), 260);
  };
  const open = () => {
    window.clearTimeout(timer.current);
    hovering.current = true;
    if (off || !host.current || (!always && !(collapsed && window.matchMedia("(min-width: 1024px)").matches))) return;
    const r = host.current.getBoundingClientRect();
    setRect({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    requestAnimationFrame(() => setShown(true));
  };
  const leave = () => {
    hovering.current = false;
    close();
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const style =
    rect &&
    (side === "right"
      ? { left: rect.right, top: (rect.top + rect.bottom) / 2, transform: "translateY(-50%)" }
      : { left: (rect.left + rect.right) / 2, top: rect.bottom, transform: "translateX(-50%)" });

  return (
    <div ref={host} className={className} onMouseEnter={open} onMouseLeave={leave}>
      {children}
      {rect &&
        style &&
        createPortal(
          // The padding is part of the tip's hit area, so moving from the icon onto the tip does not close it.
          <div
            role="tooltip"
            style={style}
            onMouseEnter={() => (hovering.current = true, window.clearTimeout(timer.current))}
            onMouseLeave={leave}
            className={`fixed z-[70] ${side === "right" ? "pl-2.5" : "pt-2"}`}
          >
            <div
              className={`whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium leading-snug text-foreground shadow-tip transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
                shown ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"
              }`}
            >
              {label}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
