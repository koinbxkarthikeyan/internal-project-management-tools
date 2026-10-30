import { create } from "zustand";

/**
 * Whether the desktop sidebar is collapsed to an icon rail. The choice is saved in this browser and also put on <html> as
 * `data-sidebar="collapsed"`, which the stylesheet reads (so a page loads already narrow; see the script in app/layout.tsx).
 * Below the `lg` breakpoint the sidebar is a slide-over drawer and this has no effect.
 */
const KEY = "sidebar";

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "collapsed";
  } catch {
    return false;
  }
};

const paint = (collapsed: boolean) => {
  if (collapsed) document.documentElement.dataset.sidebar = "collapsed";
  else delete document.documentElement.dataset.sidebar;
};

type State = {
  collapsed: boolean;
  toggle: () => void;
  /** Reads the saved choice and follows other tabs. Returns the cleanup. */
  start: () => () => void;
};

export const useSidebarStore = create<State>((set, get) => ({
  collapsed: false,

  toggle: () => {
    const next = !get().collapsed;
    try {
      localStorage.setItem(KEY, next ? "collapsed" : "expanded");
    } catch {
      // Storage unavailable: the choice still applies until the page closes.
    }
    set({ collapsed: next });
    paint(next);
  },

  start: () => {
    const apply = () => {
      const collapsed = read();
      set({ collapsed });
      paint(collapsed);
    };
    apply();
    const onStorage = (e: StorageEvent) => e.key === KEY && apply();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  },
}));
