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
