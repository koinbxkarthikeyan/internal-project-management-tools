import { FOCUS_HOURS_PER_DAY } from "@/constants/work";

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
export const formatDay = (iso: string) => dayFormat.format(toDate(iso));

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
