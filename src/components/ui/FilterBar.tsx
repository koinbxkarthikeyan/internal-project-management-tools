import type { ReactNode } from "react";

/** Width of a dropdown filter: fills a row on a phone, a fixed size from tablet up. */
export const FILTER_SELECT_CLASS = "min-w-0 flex-1 basis-36 sm:flex-none sm:basis-44";

type FilterBarProps = {
  /** The search box (leads the row; omit on pages without a list to search). */
  search?: ReactNode;
  /** How many filters are narrowing the list; 0 hides "Clear". */
  activeCount: number;
  onClear: () => void;
  /** The filters: `FilterSegments`, dropdowns (`FILTER_SELECT_CLASS`) and `DateRangeFilter`s, most important first. */
  children: ReactNode;
  /** A short line under the row (what a filter covers). */
  note?: ReactNode;
};

/** The one filter card every list page uses: search, then the filters, then "Clear (n)" when any is on. */
export default function FilterBar({ search, activeCount, onClear, children, note }: FilterBarProps) {
  return (
    <section aria-label="Search and filters" className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {search}
        {children}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="h-10 shrink-0 rounded-lg px-3 text-sm font-medium text-accent transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            Clear ({activeCount})
          </button>
        )}
      </div>
      {note && <p className="px-1 text-xs text-muted">{note}</p>}
    </section>
  );
}

type FilterSegmentsProps<T extends string> = {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
};

/** A few exclusive choices shown side by side (one tap instead of open-and-pick): for filters with 2–3 values. */
export function FilterSegments<T extends string>({ label, value, onChange, options }: FilterSegmentsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex h-10 shrink-0 items-center rounded-xl border border-border bg-background p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`h-full rounded-[0.6rem] px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type DateRangeFilterProps = {
  label: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
};

/** A from–to pair in one joined control (each end limited by the other). */
export function DateRangeFilter({ label, from, to, onChange }: DateRangeFilterProps) {
  const input = "h-full min-w-0 bg-transparent text-sm text-foreground outline-none";
  return (
    <div role="group" aria-label={label} className="field flex h-10 shrink-0 items-center gap-1.5 px-3 focus-within:border-[var(--brand-to)]">
      <span className="text-sm text-muted">{label}</span>
      <input type="date" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} aria-label={`${label} from`} className={`${input} w-[7.5rem]`} />
      <span aria-hidden="true" className="text-muted">–</span>
      <input type="date" value={to} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} aria-label={`${label} to`} className={`${input} w-[7.5rem]`} />
    </div>
  );
}
