"use client";

import { MoonIcon, SunIcon } from "@/components/ui/icons";

export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    // Switch instantly: with element transitions off, every colour changes in the same frame (no slow, uneven fade).
    root.classList.add("theme-switching");
    const isDark = root.classList.toggle("dark");
    void root.offsetHeight; // apply the new colours while transitions are still off
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      // Storage unavailable; theme still applies for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </button>
  );
}
