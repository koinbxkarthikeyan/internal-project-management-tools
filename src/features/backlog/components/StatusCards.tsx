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
      {/* The cards, in one line at every width: equal cards that share the row. Narrow: the icon and the count only (the name is the tooltip and the screen-reader label). */}
      <dl className="flex gap-2 sm:gap-3">
        {stats.map((s, i) => {
          const on = selected === s.key;
          return (
            <div key={s.label} style={{ "--i": i } as CSSProperties} className="anim-fade-up min-w-0 flex-1 basis-0">
              <button
                type="button"
                aria-pressed={on}
                title={s.label}
                onClick={() => onSelect(on && s.key !== "" ? "" : s.key)}
                className={`flex h-full w-full flex-col items-center gap-1 rounded-2xl border bg-surface px-1 py-3 text-center transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent sm:items-start sm:px-4 sm:py-3 sm:text-left ${
                  on ? "border-accent ring-2 ring-accent/40" : "border-border"
                }`}
              >
                <dt className="flex max-w-full items-center gap-1.5 text-xs font-medium leading-4 text-muted sm:items-start">
                  {s.icon ? (
                    <span className={`sm:mt-px ${s.tone}`}><StatusIcon status={s.icon} /></span>
                  ) : (
                    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 sm:mt-px">
                      <path d="M5 7h14M5 12h14M5 17h14" />
                    </svg>
                  )}
                  <span className="sr-only sm:not-sr-only sm:line-clamp-2">{s.label}</span>
                </dt>
                <dd className={`text-xl font-semibold tabular-nums sm:mt-0.5 ${s.tone}`}>{s.value}</dd>
              </button>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
