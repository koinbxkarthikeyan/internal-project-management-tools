"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type DisabledTipProps = {
  /** Why the control is disabled (and how to enable it). Falsy: the control is enabled and nothing is shown. */
  reason?: string | false | null;
  children: ReactNode;
  /** Layout of the wrapper while the control is disabled (it takes no part in the layout while enabled). */
  className?: string;
};

/**
 * Explains a disabled control. A native disabled control gets no hover or focus events and can't be tabbed to, so the
 * tooltip hangs on a wrapper: it shows on hover and on keyboard focus (the wrapper becomes a tab stop only while the
 * control is disabled), is linked with `aria-describedby` for screen readers, and closes with Escape. While the control
 * is enabled the wrapper is `display: contents`, so nothing changes. The tip is a top-layer popover, so it isn't
 * clipped by scrolling containers, tables, or the side panels (native dialogs).
 */
export function DisabledTip({ reason, children, className = "block" }: DisabledTipProps) {
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const active = !!reason;

  useEffect(() => {
    const el = tip.current;
    const anchor = wrap.current;
    if (!el || !anchor || typeof el.showPopover !== "function") return;
    if (!open || !active) {
      if (el.matches(":popover-open")) el.hidePopover();
      return;
    }
    el.showPopover();
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    const above = r.top - h - 8 >= 8;
    el.style.left = `${left}px`;
    el.style.top = `${above ? r.top - h - 8 : r.bottom + 8}px`;
    const hide = () => setOpen(false);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, active, reason]);

  return (
    <span
      ref={wrap}
      className={active ? className : "contents"}
      tabIndex={active ? 0 : undefined}
      aria-describedby={active ? id : undefined}
      onMouseEnter={() => active && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => active && setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) setOpen(false);
      }}
    >
      {children}
      {active && (
        <span
          ref={tip}
          id={id}
          role="tooltip"
          popover="manual"
          className="m-0 max-w-64 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-normal normal-case leading-snug text-foreground shadow-lg"
          style={{ position: "fixed", inset: "auto" }}
        >
          {reason}
        </span>
      )}
    </span>
  );
}
