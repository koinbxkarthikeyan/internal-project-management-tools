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

/**
 * While something is held open (a card or row showing its details), the sidebar is collapsed to give the page the width, and put back when the last one closes. It is put back only
 * if it was the page that collapsed it: a sidebar already collapsed stays as it was, and a choice the person makes meanwhile (the toggle) is never undone. This is not saved,
 * so the person's own saved choice is untouched.
 */
let holds = 0;
let autoCollapsed = false;

type State = {
  collapsed: boolean;
  toggle: () => void;
  /** A card or row opened: collapse the sidebar if it is expanded. */
  hold: () => void;
  /** It closed: when none is open any more, put the sidebar back if the page had collapsed it. */
  release: () => void;
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
    autoCollapsed = false; // the person chose: whatever the page did is no longer theirs to undo
    set({ collapsed: next });
    paint(next);
  },

  hold: () => {
    holds += 1;
    if (holds === 1 && !get().collapsed) {
      autoCollapsed = true;
      set({ collapsed: true });
      paint(true);
    }
  },

  release: () => {
    holds = Math.max(0, holds - 1);
    // Waits a moment: when one card closes as another opens, the sidebar stays collapsed instead of opening and closing again.
    setTimeout(() => {
      if (holds === 0 && autoCollapsed) {
        autoCollapsed = false;
        if (get().collapsed) {
          set({ collapsed: false });
          paint(false);
        }
      }
    }, 0);
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
