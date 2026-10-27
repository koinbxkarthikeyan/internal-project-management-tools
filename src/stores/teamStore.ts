import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Edits to the team list that live only in this browser (there is no teams table on the backend): renamed teams, removed
 * teams and teams added from the user forms. They change how team names are shown and offered; nothing is sent to the
 * backend, and no password or token is kept here.
 */
const key = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();

type TeamState = {
  /** lowercase old name -> new name */
  renames: Record<string, string>;
  /** lowercase names of teams removed from the options */
  deleted: string[];
  /** teams added in the forms (so they stay listed before anyone has them) */
  custom: string[];
  rename: (from: string, to: string) => void;
  remove: (name: string) => void;
  addCustom: (name: string) => void;
};

export const useTeamStore = create<TeamState>()(
  persist(
    (set) => ({
      renames: {},
      deleted: [],
      custom: [],
      rename: (from, to) =>
        set((s) => {
          const next = { ...s.renames };
          delete next[key(to)]; // the new name is its own team again
          next[key(from)] = to.replace(/\s+/g, " ").trim();
          return {
            renames: next,
            deleted: s.deleted.filter((d) => d !== key(to)),
            custom: s.custom.map((c) => (key(c) === key(from) ? to.replace(/\s+/g, " ").trim() : c)),
          };
        }),
      remove: (name) => set((s) => ({ deleted: [...new Set([...s.deleted, key(name)])], custom: s.custom.filter((c) => key(c) !== key(name)) })),
      addCustom: (name) =>
        set((s) => {
          const n = name.replace(/\s+/g, " ").trim();
          return s.custom.some((c) => key(c) === key(n)) ? { deleted: s.deleted.filter((d) => d !== key(n)) } : { custom: [...s.custom, n], deleted: s.deleted.filter((d) => d !== key(n)) };
        }),
    }),
    { name: "koinbx.teams.v1" },
  ),
);

/** The name to show for a team as saved on a user: follows renames (a rename of a rename too). */
export function resolveTeam(name: string, renames: Record<string, string>): string {
  let current = name.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 10; i += 1) {
    const next = renames[key(current)];
    if (!next || key(next) === key(current)) break;
    current = next;
  }
  return current;
}
