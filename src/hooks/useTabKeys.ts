import { useEffect, useRef } from "react";

type Tab = { id: string; disabled?: boolean };

/** The keys that pick a tab by its place: 1 is the first tab, 2 the second, and so on. */
export const TAB_KEYS = ["1", "2", "3"] as const;

/**
 * Number keys for a row of tabs: 1, 2, 3 pick the first, second, third tab. The one place the rule lives, so every tab row in the app answers the same way.
 * Like the other single keys they do nothing while typing in a field or with a form open, and a disabled tab is skipped. The notification panel's own tabs
 * (`panel`) answer only while that panel is open, and the page's tabs stay quiet while it is.
 */
export function useTabKeys(tabs: readonly Tab[], onSelect: (id: string) => void, { enabled = true, panel = false }: { enabled?: boolean; panel?: boolean } = {}) {
  const latest = useRef({ tabs, onSelect });
  useEffect(() => {
    latest.current = { tabs, onSelect };
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat || e.defaultPrevented || e.isComposing) return;
      const place = TAB_KEYS.indexOf(e.key as (typeof TAB_KEYS)[number]);
      if (place < 0) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=''], [contenteditable=true], [role=combobox]")) return;
      if (document.querySelector("dialog[open]")) return;
      if (!panel && document.querySelector("[role=dialog][aria-label=Notifications]")) return;
      const tab = latest.current.tabs[place];
      if (!tab || tab.disabled) return;
      e.preventDefault();
      latest.current.onSelect(tab.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, panel]);
}
