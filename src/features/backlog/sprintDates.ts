import { addDays } from "@/features/work/utils";
import type { Sprint } from "@/types/backlog";
import { formatDeadline } from "./utils";

/**
 * Sprint date rules, with no screen in them. Dates are ISO text (YYYY-MM-DD), compared as text and moved with `addDays`, which works in UTC calendar
 * days, so month ends, year ends and leap days are right and the browser's clock and time zone never matter. Only sprints that have both dates count
 * (the built-in Backlog has none). A closed sprint doesn't count: its dates are history and stay as they are, and a sprint closed early frees its days
 * (a sprint closed today can be followed by one that starts today).
 */
type Dated = { name: string; start: string; end: string };

const datedSprints = (sprints: readonly Sprint[], ignore?: string): Dated[] =>
  sprints.flatMap((s) => (s.name !== "Unplanned" && s.status !== "Closed" && s.name !== ignore && s.start && s.end ? [{ name: s.name, start: s.start, end: s.end }] : []));

/** The first day a new sprint may start: the day after the last sprint ends, or `fallback` (today) when there is none or that is later. */
export function earliestStart(sprints: readonly Sprint[], fallback: string, ignore?: string): string {
  const lastEnd = datedSprints(sprints, ignore).reduce((latest, s) => (s.end > latest ? s.end : latest), "");
  const after = lastEnd ? addDays(lastEnd, 1) : "";
  return after > fallback ? after : fallback;
}

/**
 * A message when the range `start`..`end` is not allowed, else "". The end may not be before the start, and no day of it may fall inside another
 * sprint (a sprint ending on the 25th lets the next one start on the 26th, and not before). `ignore` is the sprint being edited.
 */
export function sprintDateProblem(sprints: readonly Sprint[], start: string, end: string, ignore?: string): string {
  if (!start || !end) return "Choose a start date.";
  if (end < start) return "The end date can't be before the start date.";
  const clash = datedSprints(sprints, ignore).find((s) => start <= s.end && end >= s.start);
  if (!clash) return "";
  const free = addDays(clash.end, 1);
  return `These dates overlap ${clash.name} (${formatDeadline(clash.start)} – ${formatDeadline(clash.end)}). ${start > clash.start ? `The earliest start after ${clash.name} is ${formatDeadline(free)}.` : `Choose dates that end before ${formatDeadline(clash.start)}, or start from ${formatDeadline(free)}.`}`;
}
