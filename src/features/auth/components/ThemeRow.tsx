"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRightIcon, MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

const LABEL: Record<ThemePreference, string> = { light: "Light", dark: "Dark", system: "System" };

/**
 * The sidebar's "Theme" row (above Sign out). It shows the current choice; hovering it (or focusing it by keyboard) opens a small
 * flyout beside it with Light, Dark and System, the chosen one marked with a dot. The flyout is drawn in a portal, so the sidebar
 * never clips it, and it stays open while the pointer is on the row or on the flyout.
 */
export default function ThemeRow() {
  const preference = useThemeStore((s) => s.preference);
  const row = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null);
  useEffect(() => useThemeStore.getState().start(), []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const open = () => {
    clearTimeout(timer.current);
    const r = row.current?.getBoundingClientRect();
    if (r) setAt({ left: r.right + 8, bottom: window.innerHeight - r.bottom });
  };
  const closeSoon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAt(null), 150);
  };

  return (
    <>
      <button
        ref={row}
        data-account-part=""
        type="button"
        aria-haspopup="menu"
        aria-expanded={at !== null}
        onPointerEnter={open}
        onPointerLeave={closeSoon}
        onFocus={open}
        onBlur={closeSoon}
        onClick={open}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        <MoonIcon className="hidden shrink-0 dark:block" />
        <SunIcon className="shrink-0 dark:hidden" />
        Theme
        <span className="ml-auto text-xs">{LABEL[preference]}</span>
        <ChevronRightIcon width={14} height={14} className="shrink-0" />
      </button>
      {at &&
        createPortal(
          <div
            data-account-part=""
            role="menu"
            aria-label="Theme"
            onPointerEnter={open}
            onPointerLeave={closeSoon}
            style={{ left: at.left, bottom: at.bottom }}
            className="fixed z-[70] w-44 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
          >
            {OPTIONS.map(({ value, label, icon: Icon }) => {
              const on = preference === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => (useThemeStore.getState().setPreference(value), setAt(null))}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? "bg-foreground" : "bg-transparent"}`} />
                  <Icon width={16} height={16} className="shrink-0 text-muted" />
                  {label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
