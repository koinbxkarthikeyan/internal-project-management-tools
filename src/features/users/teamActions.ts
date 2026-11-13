import { TEAM_MAX_LENGTH } from "@/constants/auth";
import { cleanTeam } from "@/lib/auth/teams";
import { useTeamStore } from "@/stores/teamStore";
import type { AppUser } from "@/types/auth";

/**
 * Add, rename and delete a Team. Teams are kept only in this browser (there is no teams table on the backend), so nothing is sent anywhere.
 * Each returns an error message to show next to the control, or nothing when it worked.
 */
const same = (a: string, b: string) => cleanTeam(a).toLowerCase() === cleanTeam(b).toLowerCase();

export const membersIn = (users: readonly Pick<AppUser, "team">[], name: string) => users.filter((u) => u.team && same(u.team, name)).length;

/** Why a team can't be deleted (a team with members would leave them in a team that doesn't exist), or nothing. */
export function removeBlocked(users: readonly Pick<AppUser, "team">[], name: string): string | undefined {
  const n = membersIn(users, name);
  return n > 0 ? `${n} team ${n === 1 ? "member is" : "members are"} still in it. Reassign them first.` : undefined;
}

function checkName(name: string, existing: readonly string[], except?: string): string | undefined {
  const next = cleanTeam(name);
  if (!next) return "Enter a team name.";
  if (next.length > TEAM_MAX_LENGTH) return `A team name can be at most ${TEAM_MAX_LENGTH} characters.`;
  if (existing.some((t) => same(t, next) && !(except && same(t, except)))) return `A team named "${next}" already exists.`;
  return undefined;
}

export function addTeam(name: string, existing: readonly string[]): string | undefined {
  const err = checkName(name, existing);
  if (!err) useTeamStore.getState().addCustom(cleanTeam(name));
  return err;
}

export function renameTeam(from: string, to: string, existing: readonly string[]): string | undefined {
  const err = checkName(to, existing, from);
  if (!err && cleanTeam(to) !== from) useTeamStore.getState().rename(from, cleanTeam(to));
  return err;
}

export function removeTeam(users: readonly Pick<AppUser, "team">[], name: string): string | undefined {
  const blocked = removeBlocked(users, name);
  if (!blocked) useTeamStore.getState().remove(name);
  return blocked;
}
