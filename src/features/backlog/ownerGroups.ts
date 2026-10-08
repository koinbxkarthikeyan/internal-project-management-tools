import { STANDARD_ROLES } from "@/constants/owner-roles";
import type { Owner } from "@/types/backlog";

const distinct = (values: (string | undefined)[]) => [...new Set(values.filter((v): v is string => !!v))];

/** Standard roles first (in their usual order), then any other roles in use, alphabetically. */
export function roleSuggestions(owners: readonly Owner[]): string[] {
  const others = distinct(owners.map((o) => o.role))
    .filter((r) => !STANDARD_ROLES.includes(r))
    .sort((a, b) => a.localeCompare(b));
  return [...STANDARD_ROLES, ...others];
}

export const teamSuggestions = (owners: readonly Owner[]): string[] =>
  distinct(owners.map((o) => o.team)).sort((a, b) => a.localeCompare(b));

/** Names grouped under their role; people with no role go last under "No role". Empty groups are dropped. */
export function groupOwnersByRole(owners: readonly Owner[]): { label: string; options: string[] }[] {
  const groups = roleSuggestions(owners).map((role) => ({
    label: role,
    options: owners.filter((o) => o.role === role).map((o) => o.name),
  }));
  groups.push({ label: "No role", options: owners.filter((o) => !o.role).map((o) => o.name) });
  return groups.filter((g) => g.options.length > 0);
}

/** "Role · Team" for display, leaving out whatever is missing. */
export const describeOwner = (o?: Pick<Owner, "role" | "team">) => [o?.role, o?.team].filter(Boolean).join(" · ");
