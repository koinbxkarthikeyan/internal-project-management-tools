// One soft colour per sprint (the same sprint always gets the same one) for its rows and its Sprint pill, and a neutral slate for Backlog. Full class names, so Tailwind finds them.
// `row` also draws a short bar a little inside the row (not on its edge), so it never reads as part of a table border; `tint` is the background alone.
const BAR = "relative before:absolute before:inset-y-2 before:left-1.5 before:w-[3px] before:rounded-full before:content-['']";
const PILL = "inline-flex rounded-full px-2 py-0.5 text-xs font-medium";

type Colour = { row: string; tint: string; pill: string };

const SPRINT_COLOURS: Colour[] = [
  { row: `${BAR} bg-sky-500/[0.07] before:bg-sky-500/60`, tint: "bg-sky-500/[0.07]", pill: `${PILL} bg-sky-500/15 text-sky-700 dark:text-sky-300` },
  { row: `${BAR} bg-violet-500/[0.07] before:bg-violet-500/60`, tint: "bg-violet-500/[0.07]", pill: `${PILL} bg-violet-500/15 text-violet-700 dark:text-violet-300` },
  { row: `${BAR} bg-emerald-500/[0.07] before:bg-emerald-500/60`, tint: "bg-emerald-500/[0.07]", pill: `${PILL} bg-emerald-500/15 text-emerald-700 dark:text-emerald-300` },
  { row: `${BAR} bg-amber-500/[0.08] before:bg-amber-500/60`, tint: "bg-amber-500/[0.08]", pill: `${PILL} bg-amber-500/15 text-amber-700 dark:text-amber-300` },
  { row: `${BAR} bg-rose-500/[0.07] before:bg-rose-500/60`, tint: "bg-rose-500/[0.07]", pill: `${PILL} bg-rose-500/15 text-rose-700 dark:text-rose-300` },
  { row: `${BAR} bg-teal-500/[0.07] before:bg-teal-500/60`, tint: "bg-teal-500/[0.07]", pill: `${PILL} bg-teal-500/15 text-teal-700 dark:text-teal-300` },
];
const BACKLOG_COLOUR: Colour = { row: `${BAR} bg-slate-500/[0.08] before:bg-slate-500/60`, tint: "bg-slate-500/[0.08]", pill: `${PILL} bg-slate-500/15 text-slate-700 dark:text-slate-300` };

export function sprintColour(sprint: string): Colour {
  if (sprint === "Unplanned") return BACKLOG_COLOUR;
  // "Sprint 4" -> 4; any other name falls back to a sum of its characters.
  const n = Number(/\d+/.exec(sprint)?.[0] ?? [...sprint].reduce((sum, c) => sum + c.charCodeAt(0), 0));
  return SPRINT_COLOURS[n % SPRINT_COLOURS.length];
}
