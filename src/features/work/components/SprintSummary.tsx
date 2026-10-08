import { formatHours } from "../utils";

type SprintSummaryProps = {
  logged: number;
  /** Hours the whole sprint plans for one person. Worked hours beyond it are the "exceeded" (red) part of the bar. */
  limit: number;
  /** Hours we'd expect to be logged by today. */
  expected: number;
  /** False in "My sprint" until a person is picked. */
  hasPerson: boolean;
};

// One bar, three solid colours (no gradients), each with one meaning:
// - blue: worked hours up to the expected hours;
// - orange: worked hours beyond the expected hours, up to the sprint's full planned hours;
// - red: worked hours beyond that.
const BLUE = { text: "text-blue-600 dark:text-blue-300", bg: "bg-blue-500" };
const ORANGE = { text: "text-orange-600 dark:text-orange-300", bg: "bg-orange-500" };
const RED = { text: "text-red-600 dark:text-red-300", bg: "bg-red-500" };

export default function SprintSummary({ logged, limit, expected, hasPerson }: SprintSummaryProps) {
  const orangeEnd = Math.max(limit, expected);
  const blue = Math.min(logged, expected);
  const orange = Math.max(0, Math.min(logged, orangeEnd) - expected);
  const red = Math.max(0, logged - orangeEnd);
  const extra = Math.max(0, logged - expected);
  const short = expected - logged;

  // The bar is as wide as the larger of the worked and expected hours, so the segments always add up to the full width.
  const scale = Math.max(logged, expected);
  const pct = (h: number) => (scale > 0 ? (h / scale) * 100 : 0);
  const state = red > 0 ? RED : orange > 0 ? ORANGE : BLUE;

  let message: { text: string; tone: string };
  if (!hasPerson) message = { text: "Pick your name above to see your hours.", tone: "text-muted" };
  else if (expected === 0) message = { text: "This sprint hasn't started yet.", tone: "text-muted" };
  else if (short > 0.0001) {
    message = { text: `${formatHours(short)} short of the ${formatHours(expected)} we'd expect by today. Something missing, or a lighter stretch?`, tone: "text-muted" };
  } else message = { text: "On track — you're at or ahead of where we'd expect by today.", tone: "text-emerald-600 dark:text-emerald-300" };

  const segments = [
    { key: "blue", color: BLUE, from: 0, size: blue },
    { key: "orange", color: ORANGE, from: blue, size: orange },
    { key: "red", color: RED, from: blue + orange, size: red },
  ].filter((s) => s.size > 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p>
          <span className={`text-2xl font-semibold tabular-nums ${state.text}`}>{formatHours(logged)}</span>{" "}
          <span className={`text-sm font-medium ${state.text}`}>worked</span>{" "}
          <span className="text-sm text-muted">of</span>{" "}
          <span className="text-sm font-semibold tabular-nums">{formatHours(expected)}</span>{" "}
          <span className="text-sm text-muted">expected so far</span>
        </p>
        <p className="text-xs text-muted">{formatHours(expected)} expected by today</p>
      </div>
      <p className={`mt-1 text-sm ${message.tone}`}>{message.text}</p>

      {/* The single progress bar. Each colour is its own solid block, separated from the next by a thin gap. */}
      <div className="group relative mt-4 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" tabIndex={0} aria-describedby="hours-tooltip">
        <div
          role="progressbar"
          aria-label="Hours worked against hours expected"
          aria-valuemin={0}
          aria-valuemax={scale}
          aria-valuenow={logged}
          className="relative h-3 overflow-hidden rounded-full bg-hover"
        >
          {segments.map((s, i) => (
            <div
              key={s.key}
              className={`absolute inset-y-0 ${s.color.bg} transition-[width,left] duration-500 ${i > 0 ? "border-l-2 border-surface" : ""}`}
              style={{ left: `${pct(s.from)}%`, width: `${pct(s.size)}%` }}
            />
          ))}
        </div>
        <div
          id="hours-tooltip"
          role="tooltip"
          className="pointer-events-none invisible absolute left-0 top-full z-20 mt-3 w-60 rounded-xl border border-border bg-surface p-3 text-xs opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100"
        >
          <p className="flex justify-between gap-3">
            <span className={`flex items-center gap-1.5 font-medium ${BLUE.text}`}>
              <span className={`h-2 w-2 rounded-full ${BLUE.bg}`} aria-hidden="true" />
              Expected
            </span>
            <span className="tabular-nums">{formatHours(expected)}</span>
          </p>
          <p className="mt-1 flex justify-between gap-3">
            <span className={`flex items-center gap-1.5 font-medium ${state.text}`}>
              <span className={`h-2 w-2 rounded-full ${state.bg}`} aria-hidden="true" />
              Worked
            </span>
            <span className="tabular-nums">{formatHours(logged)}</span>
          </p>
          <p className="mt-1.5 flex justify-between gap-3 border-t border-border pt-1.5 font-semibold">
            <span className={extra > 0 ? state.text : ""}>Extra</span>
            <span className="tabular-nums">{formatHours(extra)}</span>
          </p>
        </div>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${BLUE.bg}`} aria-hidden="true" />
          Worked, up to expected
        </li>
        <li className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${ORANGE.bg}`} aria-hidden="true" />
          Beyond expected
        </li>
        <li className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${RED.bg}`} aria-hidden="true" />
          Beyond the sprint&apos;s planned hours
        </li>
      </ul>
    </div>
  );
}
