import EmptyState from "@/components/ui/EmptyState";
import type { Sprint } from "@/types/backlog";
import type { WorkEntry } from "@/types/work";
import { eachDay, formatDay, isWeekend } from "../utils";

type SprintGlanceProps = {
  sprint: Sprint;
  entries: readonly WorkEntry[];
  /** Show the person's name on each bar (Everyone view). */
  showPerson: boolean;
  /** Heading text (default "Your sprint at a glance"). */
  title?: string;
};

/** Day-by-day timeline of the sprint with a bar for each logged piece of work. */
export default function SprintGlance({ sprint, entries, showPerson, title = "Your sprint at a glance" }: SprintGlanceProps) {
  const days = eachDay(sprint.start ?? "", sprint.end ?? "");
  const cols = { gridTemplateColumns: `repeat(${days.length}, minmax(1.75rem, 1fr))` };

  return (
    <section aria-label={title}>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>

      {entries.length === 0 ? (
        <EmptyState compact title="Nothing on the timeline yet" description="Add what you're working on below and it will appear here." />
      ) : (
        <div className="mt-3 overflow-x-auto pb-1">
          <div style={{ minWidth: `${days.length * 1.75}rem` }}>
            <div className="grid text-center text-[11px] tabular-nums" style={cols}>
              {days.map((d, i) => (
                <span key={d} className={isWeekend(d) ? "text-muted/60" : "text-muted"} title={formatDay(d)}>
                  {i + 1}
                </span>
              ))}
            </div>

            <ul className="mt-1.5 flex flex-col gap-1.5">
              {entries.map((e) => {
                const start = Math.max(days.indexOf(e.from < days[0] ? days[0] : e.from), 0);
                const endRaw = days.indexOf(e.to > days[days.length - 1] ? days[days.length - 1] : e.to);
                const end = Math.max(endRaw, start);
                return (
                  <li key={e.id} className="relative">
                    <div className="absolute inset-0 grid" style={cols} aria-hidden="true">
                      {days.map((d) => (
                        <span key={d} className={`border-l border-border first:border-l-0 ${isWeekend(d) ? "bg-hover/60" : ""}`} />
                      ))}
                    </div>
                    <div className="relative grid" style={cols}>
                      <span
                        className="min-w-0 truncate rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent"
                        style={{ gridColumn: `${start + 1} / ${end + 2}` }}
                        title={`${e.task} · ${formatDay(e.from)} → ${formatDay(e.to)}`}
                      >
                        {showPerson ? `${e.person}: ` : ""}
                        {e.task}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
