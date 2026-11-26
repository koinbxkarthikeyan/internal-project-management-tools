"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { useThemeStore } from "@/stores/themeStore";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const subscribeSystem = (notify: () => void) => {
  const media = matchMedia(DARK_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

/**
 * The sidebar's theme button: one click switches between Light and Dark; its icon shows the look in use, and while you hover it (or focus it by keyboard) it previews the look a click gives: the other icon, and the button takes a soft tint of that icon's colour (blue for dark, amber for light). Choosing System Default (follow the device) is done in Settings;
 * while it is chosen, the button shows the look the device gives and a click picks the other one. The saved choice and the system listener live in the theme store.
 * In the collapsed desktop rail the button is hidden (see globals.css).
 */
export default function ThemeMenu() {
  const preference = useThemeStore((s) => s.preference);
  const systemDark = useSyncExternalStore(subscribeSystem, () => matchMedia(DARK_QUERY).matches, () => false);
  useEffect(() => useThemeStore.getState().start(), []);

  const dark = preference === "dark" || (preference === "system" && systemDark);
  const next = dark ? "light" : "dark";
  // While the pointer is over the button it shows the look a click will give (the other icon, in its colour); after a click it shows the new look until the pointer leaves.
  const [peek, setPeek] = useState(false);
  const shownDark = peek ? !dark : dark;
  const label = `Switch to ${next} mode`;

  // Both icons are in the button; the one for the look in use shows (a sun, warm amber, for light; a moon, soft blue, for dark) and they turn into each other when it changes.
  const swap = "absolute inset-0 m-auto transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none";
  return (
    <button
      type="button"
      onClick={() => (setPeek(false), useThemeStore.getState().setPreference(next))}
      onPointerEnter={() => setPeek(true)}
      onPointerLeave={() => setPeek(false)}
      onFocus={(e) => e.currentTarget.matches(":focus-visible") && setPeek(true)}
      onBlur={() => setPeek(false)}
      aria-label={label}
      title={label}
      className={`sb-theme relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-[background-color,border-color] duration-300 ease-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-accent ${peek ? (shownDark ? "border-sky-400/40 bg-sky-400/15" : "border-amber-400/50 bg-amber-400/15") : "border-border bg-transparent"}`}
    >
      <span aria-hidden="true" className="theme-shake absolute inset-0">
      <SunIcon width={18} height={18} className={`${swap} text-amber-500 ${shownDark ? "-rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
      <MoonIcon width={18} height={18} className={`${swap} text-sky-400 ${shownDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0"}`} />
      </span>
    </button>
  );
}
