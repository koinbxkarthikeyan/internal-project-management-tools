import type { CSSProperties } from "react";
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

const TONES: Record<Status, string> = {
  Open: "text-blue-600 dark:text-blue-300",
  "In progress": "text-violet-600 dark:text-violet-300",
  Blocked: "text-red-600 dark:text-red-300",
  "On hold": "text-amber-600 dark:text-amber-300",
  Completed: "text-emerald-600 dark:text-emerald-300",
};

/** One card per task status (named as the app names it) with how many of the listed tasks have it, and a Total card. Give it the tasks that match the search and filters (leaving the status filter out): a card filters the table to its status. */
export default function StatusCards({ items, selected, onSelect, partial = false, partialTotal }: StatusCardsProps) {
  const stats: { key: Status | ""; label: string; value: number | string; tone: string }[] = [
    { key: "", label: "Total items", value: partial ? (partialTotal ?? "–") : items.length, tone: "text-foreground" },
    ...STATUSES.map((s) => ({ key: s, label: statusLabel(s), value: partial ? "–" : items.filter((i) => i.status === s).length, tone: TONES[s] })),
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
                <dt className="text-xs font-medium text-muted">{s.label}</dt>
                <dd className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone}`}>{s.value}</dd>
              </button>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
