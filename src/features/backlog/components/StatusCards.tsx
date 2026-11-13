import type { CSSProperties } from "react";
import { StatusIcon } from "@/components/ui/Badge";
import { STATUSES, statusLabel } from "@/constants/backlog-options";
import type { BacklogItemData, Status } from "@/types/backlog";

type StatusCardsProps = {
  items: readonly BacklogItemData[];
  /** The status the table is filtered to ("" = all): its card is shown as selected. */
  selected: string;
  /** A card was clicked: filter the table to that status ("" = Total, no status filter). */
  onSelect: (status: Status | "") => void;
  /** Only the first pages of the table are loaded: the counts wait for every task (shown as "–"). */
  partial?: boolean;
  /** While partial: the Total, when it is already known (no search or filter applied). */
  partialTotal?: number;
};

// The same colours as the status badges, so a card and the badges of its rows match.
const TONES: Record<Status, string> = {
  Open: "text-slate-600 dark:text-slate-300",
  "In progress": "text-violet-600 dark:text-violet-400",
  Blocked: "text-rose-600 dark:text-rose-400",
  "On hold": "text-amber-600 dark:text-amber-400",
  Completed: "text-emerald-600 dark:text-emerald-400",
};

/** One card per task status (named as the app names it) with how many of the listed tasks have it, and a Total card. Give it the tasks that match the search and filters (leaving the status filter out): a card filters the table to its status. */
export default function StatusCards({ items, selected, onSelect, partial = false, partialTotal }: StatusCardsProps) {
  const stats: { key: Status | ""; icon?: Status; label: string; value: number | string; tone: string }[] = [
    { key: "", label: "Total items", value: partial ? (partialTotal ?? "–") : items.length, tone: "text-foreground" },
    ...STATUSES.map((s) => ({ key: s, icon: s, label: statusLabel(s), value: partial ? "–" : items.filter((i) => i.status === s).length, tone: TONES[s] })),
  ];

  return (
    <section aria-label="Backlog summary">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s, i) => {
          const on = selected === s.key;
          return (
            <div key={s.label} style={{ "--i": i } as CSSProperties} className="anim-fade-up">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(on && s.key !== "" ? "" : s.key)}
                className={`block w-full rounded-2xl border bg-surface p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent ${
                  on ? "border-accent ring-2 ring-accent/40" : "border-border"
                }`}
              >
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  {s.icon ? (
                    <span className={s.tone}><StatusIcon status={s.icon} /></span>
                  ) : (
                    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                      <path d="M5 7h14M5 12h14M5 17h14" />
                    </svg>
                  )}
                  {s.label}
                </dt>
                <dd className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone}`}>{s.value}</dd>
              </button>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
