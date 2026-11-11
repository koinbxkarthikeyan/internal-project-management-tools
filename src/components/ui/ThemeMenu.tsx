"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light Mode", icon: SunIcon },
  { value: "dark", label: "Dark Mode", icon: MoonIcon },
  { value: "system", label: "System Default", icon: MonitorIcon },
];

const WIDTH = 208;

/**
 * The sidebar's theme button: its icon shows the choice in use, and clicking it opens a small menu with Light Mode, Dark Mode and System Default. Picking one applies
 * it at once and closes the menu, as does a click outside or Escape. The saved choice and the system listener live in the theme store.
 * The menu is drawn on the page, not inside the sidebar. In the collapsed desktop rail the button is hidden (see globals.css).
 */
export default function ThemeMenu() {
  const preference = useThemeStore((s) => s.preference);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => useThemeStore.getState().start(), []);

  const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[2];
  const CurrentIcon = current.icon;

  function toggle() {
    if (!open && button.current) {
      const r = button.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8)) });
    }
    setOpen((o) => !o);
  }

  function choose(value: ThemePreference) {
    useThemeStore.getState().setPreference(value);
    setOpen(false);
    button.current?.focus();
  }

  // Outside click closes; the first option takes focus when the menu opens so the keyboard works at once.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function onMenuKey(e: React.KeyboardEvent) {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={`Theme: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`sb-theme inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
          open ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover hover:text-foreground"
        }`}
      >
        <CurrentIcon width={18} height={18} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label="Theme"
            onKeyDown={onMenuKey}
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
            className="anim-fade-up fixed z-[60] flex flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-menu"
          >
            {OPTIONS.map(({ value, label, icon: Icon }) => {
              const on = preference === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => choose(value)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    on ? "bg-accent-soft font-medium text-accent" : "text-foreground hover:bg-hover"
                  }`}
                >
                  <Icon width={16} height={16} className="shrink-0" />
                  <span className="flex-1">{label}</span>
                  {on && <CheckIcon width={16} height={16} className="shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
