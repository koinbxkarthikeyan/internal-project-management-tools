import { create } from "zustand";

/** The pages a person starred (Pinned) and the last pages they opened (Recent). Saved in this browser only, never on the server. */
const PINS_KEY = "koinbx.pinnedPages";
const RECENT_KEY = "koinbx.recentPages";
export const RECENT_LIMIT = 6;

const read = (key: string): string[] => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const write = (key: string, value: string[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the lists still work until the page closes.
  }
};

type State = {
  pins: string[];
  recents: string[];
  /** Reads the saved lists (once the page is in the browser). */
  load: () => void;
  togglePin: (href: string) => void;
  /** Puts a page first in Recent (no repeats, at most six). */
  visit: (href: string) => void;
};

export const usePagesStore = create<State>((set, get) => ({
  pins: [],
  recents: [],
  load: () => set({ pins: read(PINS_KEY), recents: read(RECENT_KEY) }),
  togglePin: (href) => {
    const pins = get().pins.includes(href) ? get().pins.filter((h) => h !== href) : [...get().pins, href];
    write(PINS_KEY, pins);
    set({ pins });
  },
  visit: (href) => {
    const recents = [href, ...get().recents.filter((h) => h !== href)].slice(0, RECENT_LIMIT);
    write(RECENT_KEY, recents);
    set({ recents });
  },
}));
