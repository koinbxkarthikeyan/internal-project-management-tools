import type { CSSProperties } from "react";
import { StatusIcon } from "@/components/ui/Badge";
import type { BacklogItemData, Status } from "@/types/backlog";

type BacklogSummaryProps = {
  items: readonly BacklogItemData[];
  /** While only the first pages of the table are loaded: how many tasks there are in all. The counts by status need every task, so they wait (shown as "–"). */
  partialTotal?: number;
};

export default function BacklogSummary({ items, partialTotal }: BacklogSummaryProps) {
  const partial = partialTotal !== undefined;
  const count = (fn: (i: BacklogItemData) => boolean): number | string => (partial ? "–" : items.filter(fn).length);
  const stats: { label: string; value: number | string; tone: string; icon?: Status }[] = [
    { label: "Total items", value: partial ? partialTotal : items.length, tone: "text-foreground" },
    { label: "Open", icon: "Open", value: count((i) => i.status === "Open" || i.status === "In progress"), tone: "text-blue-700 dark:text-blue-300" },
    { label: "Ready for QA", icon: "Ready for QA", value: count((i) => i.status === "Ready for QA"), tone: "text-cyan-700 dark:text-cyan-300" },
    { label: "Testing", icon: "Testing", value: count((i) => i.status === "Testing"), tone: "text-indigo-700 dark:text-indigo-300" },
    { label: "Blocked", icon: "Blocked", value: count((i) => i.status === "Blocked"), tone: "text-red-700 dark:text-red-300" },
    { label: "On hold", icon: "On hold", value: count((i) => i.status === "On hold"), tone: "text-amber-700 dark:text-amber-300" },
    { label: "Done", icon: "Done", value: count((i) => i.status === "Done"), tone: "text-emerald-700 dark:text-emerald-300" },
  ];

  return (
    <section aria-label="Backlog summary">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {stats.map((s, i) => (
          <div
            key={s.label}
            style={{ "--i": i } as CSSProperties}
            className="anim-fade-up card p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
              {s.icon ? (
                <span className={`shrink-0 ${s.tone}`}><StatusIcon status={s.icon} /></span>
              ) : (
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                  <path d="M5 7h14M5 12h14M5 17h14" />
                </svg>
              )}
              {s.label}
            </dt>
            <dd className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
