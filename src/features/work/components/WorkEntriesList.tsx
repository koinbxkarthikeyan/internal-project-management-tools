"use client";

import type { ReactNode } from "react";
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
  /** The sprint hours line ("5h logged · 54h expected so far · 60h total sprint hours") shown under the title. */
  hoursLine?: ReactNode;
  /** When given, each entry also has a "View Full Details" button. */
  onView?: (entry: WorkEntry) => void;
  /** Called when the user clicks remove; the page asks for confirmation before deleting. */
  onRemove: (entry: WorkEntry) => void;
};

const tag = "rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted";
const textButton =
  "rounded-md px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-accent";

export default function WorkEntriesList({ title, entries, showPerson, sprintTotals, hoursLine, onChange, onView, onRemove }: WorkEntriesListProps) {
  const total = entries.reduce((sum, e) => sum + e.hours, 0);

  return (
    <section aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-accent">{title}</h3>
        <span className="text-xs tabular-nums text-muted">
          {entries.length} · {formatHours(total)}
        </span>
      </div>

      {hoursLine}

      {sprintTotals && sprintTotals.length > 0 && (
        <p className="mt-1 font-mono text-[11px] text-muted" title="Your logged hours per sprint">
          {sprintTotals.map((s) => `${s.name}: ${formatHours(s.hours)}`).join(" | ")} | <span className="font-semibold text-foreground">Total: {formatHours(sprintTotals.reduce((sum, s) => sum + s.hours, 0))}</span>
        </p>
      )}

      {entries.length === 0 ? (
        <EmptyState compact title="Nothing added yet" description="What you add will be listed here with its dates and hours." />
      ) : (
        <ul className="@container mt-3 divide-y divide-border">
          {entries.map((e) => {
            const actionButtons = (
              <>
                {onView && (
                  <button type="button" className={textButton} onClick={() => onView(e)} aria-label={`View full details of ${e.task}`}>
                    View Full Details
                  </button>
                )}
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
              </>
            );
            const line = (label: string, value: ReactNode) => (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="min-w-0 text-right">{value}</dd>
              </div>
            );
            return (
              <li
                key={e.id}
                // Clicking the card opens its full details (the buttons inside keep doing their own thing; the View Full Details button is the keyboard way in).
                onClick={onView ? (ev) => !(ev.target as HTMLElement).closest("button, a") && onView(e) : undefined}
                className={`py-3 ${onView ? "-mx-2 cursor-pointer rounded-lg px-2 transition-colors hover:bg-hover/60" : ""}`}
              >
                {/* Narrow: the same card as every other list: the task on the left, the actions on the right, then one label / value line per field. */}
                <div className="@xl:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-sm font-medium text-foreground">{e.task}</p>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{actionButtons}</div>
                  </div>
                  <dl className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2 text-sm">
                    {showPerson && line("Person", e.person)}
                    {line("POD", e.pod)}
                    {line("Type", e.kind)}
                    {line("Dates", <span className="tabular-nums">{formatDay(e.from)} → {formatDay(e.to)}</span>)}
                    {line("Hours", <span className="font-semibold tabular-nums">{formatHours(e.hours)}</span>)}
                    {e.notes && line("Notes", <span className="whitespace-pre-line break-words text-muted">{e.notes}</span>)}
                  </dl>
                </div>
                <div className="hidden flex-wrap items-start justify-between gap-x-4 gap-y-2 @xl:flex">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="text-sm font-semibold text-foreground">{e.task}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {showPerson && <span className={`${tag} text-foreground`}>{e.person}</span>}
                      <span className={tag}>{e.pod}</span>
                      <span className={tag}>{e.kind}</span>
                    </p>
                    <p className="mt-1.5 text-xs tabular-nums text-muted">
                      {formatDay(e.from)} → {formatDay(e.to)} · <span className="font-semibold text-foreground">{formatHours(e.hours)}</span>
                    </p>
                    {e.notes && <p className="mt-1 whitespace-pre-line break-words text-xs text-muted">{e.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1">{actionButtons}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
