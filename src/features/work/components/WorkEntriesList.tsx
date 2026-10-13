"use client";

import EmptyState from "@/components/ui/EmptyState";
import type { WorkEntry } from "@/types/work";
import { formatDay, formatHours } from "../utils";

type WorkEntriesListProps = {
  title: string;
  entries: readonly WorkEntry[];
  showPerson: boolean;
  /** Your hours in every sprint, one by one (earlier sprints included), for the line under the title. */
  sprintTotals?: readonly { name: string; hours: number }[];
  onChange: (entry: WorkEntry) => void;
  /** Called when the user clicks remove; the page asks for confirmation before deleting. */
  onRemove: (entry: WorkEntry) => void;
};

const tag = "rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted";
const textButton =
  "rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-accent";

export default function WorkEntriesList({ title, entries, showPerson, sprintTotals, onChange, onRemove }: WorkEntriesListProps) {
  const total = entries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs tabular-nums text-muted">
          {entries.length} · {formatHours(total)}
        </span>
      </div>

      {sprintTotals && sprintTotals.length > 0 && (
        <p className="mt-1 font-mono text-[11px] text-muted" title="Your logged hours per sprint">
          {sprintTotals.map((s) => `${s.name}: ${formatHours(s.hours)}`).join(" | ")} | <span className="font-semibold text-foreground">Total: {formatHours(sprintTotals.reduce((sum, s) => sum + s.hours, 0))}</span>
        </p>
      )}

      {entries.length === 0 ? (
        <EmptyState compact title="Nothing added yet" description="What you add will be listed here with its dates and hours." />
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-sm font-medium">{e.task}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {showPerson && <span className={`${tag} text-foreground`}>{e.person}</span>}
                  <span className={tag}>{e.pod}</span>
                  <span className={tag}>{e.kind}</span>
                </p>
                <p className="mt-1.5 text-xs tabular-nums text-muted">
                  {formatDay(e.from)} → {formatDay(e.to)} · {formatHours(e.hours)}
                </p>
                {e.notes && <p className="mt-1 whitespace-pre-line break-words text-xs text-muted">{e.notes}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className={textButton} onClick={() => onChange(e)} aria-label={`Change ${e.task}`}>
                  change
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${e.task}`}
                  onClick={() => onRemove(e)}
                  className={`${textButton} hover:text-red-600 dark:hover:text-red-300`}
                >
                  remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
