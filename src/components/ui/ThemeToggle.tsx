"use client";

import { useEffect } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof SunIcon }[] = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

/** System / Light / Dark. The saved choice and the system listener live in the theme store. */
export default function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference);
  useEffect(() => useThemeStore.getState().start(), []);

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border p-0.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => useThemeStore.getState().setPreference(value)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              on ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover hover:text-foreground"
            }`}
          >
            <Icon width={16} height={16} />
          </button>
        );
      })}
    </div>
  );
}
