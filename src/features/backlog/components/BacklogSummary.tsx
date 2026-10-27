import type { CSSProperties } from "react";
import type { BacklogItemData } from "@/types/backlog";

type BacklogSummaryProps = {
  items: readonly BacklogItemData[];
  /** While only the first pages of the table are loaded: how many tasks there are in all. The counts by status need every task, so they wait (shown as "–"). */
  partialTotal?: number;
};

export default function BacklogSummary({ items, partialTotal }: BacklogSummaryProps) {
  const partial = partialTotal !== undefined;
  const count = (fn: (i: BacklogItemData) => boolean): number | string => (partial ? "–" : items.filter(fn).length);
  const stats = [
    { label: "Total items", value: partial ? partialTotal : items.length, tone: "text-foreground" },
    { label: "Open", value: count((i) => i.status === "Open" || i.status === "In progress"), tone: "text-blue-600 dark:text-blue-300" },
    { label: "Blocked", value: count((i) => i.status === "Blocked"), tone: "text-red-600 dark:text-red-300" },
    { label: "On hold", value: count((i) => i.status === "On hold"), tone: "text-amber-600 dark:text-amber-300" },
    { label: "Completed", value: count((i) => i.status === "Completed"), tone: "text-emerald-600 dark:text-emerald-300" },
  ];

  return (
    <section aria-label="Backlog summary">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((s, i) => (
          <div
            key={s.label}
            style={{ "--i": i } as CSSProperties}
            className="anim-fade-up rounded-2xl border border-border bg-surface p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <dt className="text-xs font-medium text-muted">{s.label}</dt>
            <dd className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
