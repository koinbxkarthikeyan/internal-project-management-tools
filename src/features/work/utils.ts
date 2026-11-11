import { FOCUS_HOURS_PER_DAY } from "@/constants/work";
import type { WorkEntry } from "@/types/work";

const DAY_MS = 86_400_000;
const MAX_DAYS = 62; // guard against absurd ranges

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toISO = (d: Date) => d.toISOString().slice(0, 10);

export const isWeekend = (iso: string) => [0, 6].includes(toDate(iso).getUTCDay());

/** Every calendar day from `start` to `end`, inclusive. */
export function eachDay(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const days: string[] = [];
  for (let d = toDate(start); toISO(d) <= end && days.length < MAX_DAYS; d = new Date(d.getTime() + DAY_MS)) {
    days.push(toISO(d));
  }
  return days;
}

export const addDays = (iso: string, n: number) => toISO(new Date(toDate(iso).getTime() + n * DAY_MS));

export const workingDays = (start: string, end: string) => eachDay(start, end).filter((d) => !isWeekend(d)).length;

/** Default hours for a stretch: every working day at the planned focus hours. */
export const plannedHours = (start: string, end: string) => workingDays(start, end) * FOCUS_HOURS_PER_DAY;

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
/** A day like "6 Oct"; "–" when the entry carries no valid date (the backend may leave it out). */
export const formatDay = (iso: string) => {
  const d = toDate(iso);
  return Number.isNaN(d.getTime()) ? "–" : dayFormat.format(d);
};

/** Display hours without trailing zeros: 24, 2.5. */
export const formatHours = (h: number) => `${Math.round(h * 100) / 100}h`;

/** The signed-in person's logged hours in every sprint (earlier ones included), each logged entry counted once. */
export function myHoursBySprint(
  entries: readonly { id: string; sprintId: string; hours: number; person: string; personId?: string }[],
  sprints: readonly { id: string; name: string }[],
  me: { id?: string; name: string },
) {
  const mine = [...new Map(entries.filter((e) => (e.personId ? e.personId === me.id : e.person === me.name)).map((e) => [e.id, e])).values()];
  return sprints.map((s) => ({ name: s.name, hours: mine.filter((e) => e.sprintId === s.id).reduce((sum, e) => sum + e.hours, 0) }));
}

/** The running sprint and the two sprints before it (by start date), oldest first; with no running sprint, the three latest. Fewer when fewer exist. */
export function recentSprints<T extends { id?: string; start: string; end: string; status?: string }>(sprints: readonly T[]): T[] {
  // Newest first by start date, then end date; sprints that share both (several made on one day) go by their number, the highest first.
  const num = (s: { id?: string }) => Number(s.id) || 0;
  const newest = [...sprints].sort((a, b) => b.start.localeCompare(a.start) || b.end.localeCompare(a.end) || num(b) - num(a));
  const at = Math.max(0, newest.findIndex((s) => s.status === "Active"));
  return newest.slice(at, at + 3).reverse(); // oldest first, the running sprint last
}

/** The most recently saved entry (by its saved time, then its id), or undefined when there is none. */
export function latestEntry<T extends { id: string; createdAt: string }>(entries: readonly T[]): T | undefined {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (Number(b.id) || 0) - (Number(a.id) || 0))[0];
}

/**
 * Expected hours for one person over the given sprints, weekdays only (6h each): `soFar` from each sprint's start through today (never past its end,
 * and 0 before it starts) and `total` for the whole of each sprint. The one place this is worked out.
 */
export function sprintHours(sprints: readonly { start: string; end: string }[], today: string) {
  const soFar = sprints.reduce((sum, s) => sum + (today < s.start ? 0 : plannedHours(s.start, today > s.end ? s.end : today)), 0);
  const total = sprints.reduce((sum, s) => sum + plannedHours(s.start, s.end), 0);
  return { soFar, total };
}

/** The one-line hours summary used on every sprint page: "5h logged · 54h expected so far · 60h total sprint hours". */
export const hoursSummary = (logged: number, soFar: number, total: number) =>
  `${formatHours(logged)} logged · ${formatHours(soFar)} expected so far · ${formatHours(total)} total sprint hours`;

/** Logged hours as a share of the whole sprint's hours (never of the expected-so-far hours); 0 when the sprint has no hours. */
export const percentOfTotal = (logged: number, total: number) => (total > 0 ? Math.round((logged / total) * 100) : 0);

/** Where logged hours stand: fewer than expected so far, at or above it, or over the sprint's total. */
export function hoursStanding(logged: number, soFar: number, total: number): { tone: "below" | "above" | "over"; label: string } {
  if (total > 0 && logged > total) return { tone: "over", label: `${formatHours(logged - total)} over the total sprint hours` };
  if (logged < soFar - 0.0001) return { tone: "below", label: `${formatHours(soFar - logged)} below expected` };
  if (logged > soFar + 0.0001) return { tone: "above", label: `${formatHours(logged - soFar)} above expected` };
  return { tone: "above", label: "on target" };
}

/**
 * Hours per sprint for one task and the earlier records it was carried over from (oldest first): every work entry counts in the sprint it was logged in
 * (its `sprintId`), each entry once, so hours logged in Sprint 6 stay in Sprint 6 when the task is later moved to Sprint 7. A Backlog record keeps its own hours
 * (nothing is attributed to a sprint there), and an entry with no known sprint falls back to the record it was logged against.
 */
export function hoursBySprint(records: readonly { id: string; sprint: string; historySprintIds?: (string | null)[] }[], entries: readonly WorkEntry[], sprints: readonly { id: string; name: string }[]) {
  const parts = records.map((r) => ({ name: r.sprint, hours: 0 }));
  // A task carried over keeps a line for every sprint it has been in, so a sprint where nothing was logged still reads "Sprint 6: 0h".
  records.forEach((r, i) => {
    const before = (r.historySprintIds ?? []).map((id) => sprints.find((s) => s.id === id)?.name).filter((n): n is string => !!n && n !== r.sprint && !parts.some((p) => p.name === n));
    const at = parts.findIndex((p, k) => k >= i && p.name === r.sprint);
    parts.splice(at < 0 ? i : at, 0, ...[...new Set(before)].map((name) => ({ name, hours: 0 })));
  });
  const counted = new Set<string>();
  for (const e of entries) {
    if (counted.has(e.id)) continue;
    const at = records.findIndex((r) => e.itemIds?.includes(r.id));
    if (at < 0) continue;
    counted.add(e.id);
    const logged = records[at].sprint === "Unplanned" || !e.sprintId ? undefined : sprints.find((s) => s.id === e.sprintId)?.name;
    let part = logged ? parts.find((p) => p.name === logged) : undefined;
    if (logged && !part) {
      part = { name: logged, hours: 0 };
      parts.splice(Math.max(0, parts.findIndex((p) => p.name === records[at].sprint)), 0, part);
    }
    (part ?? parts.find((p) => p.name === records[at].sprint))!.hours += e.hours;
  }
  return parts;
}
