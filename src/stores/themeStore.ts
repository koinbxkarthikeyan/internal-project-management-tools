import { create } from "zustand";

/**
 * The theme the person chose ("system" follows the operating system) and the look that results from it. Only the choice
 * is saved (never the resolved "light" / "dark"), so picking System again follows the current system setting at once.
 */
export type ThemePreference = "system" | "light" | "dark";

const KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const readSaved = (): ThemePreference => {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
};

/** Puts the look on <html>: colours switch in one frame (transitions are off while it changes). */
function paint(preference: ThemePreference, animate: boolean) {
  const root = document.documentElement;
  const dark = preference === "dark" || (preference === "system" && matchMedia(DARK_QUERY).matches);
  if (root.classList.contains("dark") === dark) return;
  if (animate) root.classList.add("theme-switching");
  root.classList.toggle("dark", dark);
  if (animate) {
    void root.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  }
}

type State = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  /** Reads the saved choice and starts following the system and other tabs. Returns the cleanup. */
  start: () => () => void;
};

export const useThemeStore = create<State>((set, get) => ({
  preference: "system",

  setPreference: (next) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage unavailable: the choice still applies until the page closes.
    }
    set({ preference: next });
    paint(next, true);
  },

  start: () => {
    set({ preference: readSaved() });
    paint(get().preference, false);
    const media = matchMedia(DARK_QUERY);
    // The system changed: it only matters while System is chosen (a Light or Dark choice is never overridden).
    const onSystem = () => get().preference === "system" && paint("system", true);
    // Another tab chose a theme.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY && e.key !== null) return;
      set({ preference: readSaved() });
      paint(get().preference, true);
    };
    media.addEventListener("change", onSystem);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystem);
      window.removeEventListener("storage", onStorage);
    };
  },
}));
