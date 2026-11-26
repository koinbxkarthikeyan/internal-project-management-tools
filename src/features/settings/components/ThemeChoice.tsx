"use client";

import { useEffect } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light Mode", icon: SunIcon },
  { value: "dark", label: "Dark Mode", icon: MoonIcon },
  { value: "system", label: "System Default", icon: MonitorIcon },
];

/** The choice of Light Mode, Dark Mode or System Default, as one compact group (it sits in the Settings account strip). The sidebar button switches between Light and Dark with one click; this is where System Default is chosen. */
export default function ThemeChoice() {
  const preference = useThemeStore((s) => s.preference);
  useEffect(() => useThemeStore.getState().start(), []);
  return (
    // A labelled segmented control: the chosen segment is raised like a tab, so the three choices read as one control.
    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
      <span id="appearance-label" className="text-[11px] font-semibold uppercase tracking-wider text-muted">Appearance</span>
      <div role="radiogroup" aria-labelledby="appearance-label" className="flex flex-col gap-0.5 rounded-lg border border-border p-0.5">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const on = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => useThemeStore.getState().setPreference(value)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                on ? "bg-surface font-medium text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              <Icon width={15} height={15} className={`shrink-0 ${on ? "text-accent" : ""}`} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
