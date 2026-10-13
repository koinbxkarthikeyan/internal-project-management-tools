import { DEFAULT_TEAMS } from "@/constants/auth";
import type { AppUser } from "@/types/auth";

/** Trims and collapses repeated spaces. */
export const cleanTeam = (name: string): string => name.replace(/\s+/g, " ").trim();

const same = (a: string, b: string) => cleanTeam(a).toLowerCase() === cleanTeam(b).toLowerCase();

/**
 * Every team that can be picked: the defaults plus every team saved on a user in the backend, so a team typed once
 * stays available for the next user. Names that differ only by case or spacing are one team (the first spelling wins).
 */
export function teamOptions(users: readonly Pick<AppUser, "team">[], extra: readonly string[] = []): string[] {
  const out: string[] = [];
  const add = (name?: string) => {
    const n = cleanTeam(name ?? "");
    if (n && !out.some((t) => same(t, n))) out.push(n);
  };
  DEFAULT_TEAMS.forEach(add);
  [...users.map((u) => u.team), ...extra].forEach(add);
  return [...out.slice(0, DEFAULT_TEAMS.length), ...out.slice(DEFAULT_TEAMS.length).sort((a, b) => a.localeCompare(b))];
}

/** The existing spelling of a team if it's already known, otherwise the cleaned name (a new team). */
export const canonicalTeam = (name: string, options: readonly string[]): string => options.find((t) => same(t, name)) ?? cleanTeam(name);

export const isKnownTeam = (name: string, options: readonly string[]): boolean => options.some((t) => same(t, name));
