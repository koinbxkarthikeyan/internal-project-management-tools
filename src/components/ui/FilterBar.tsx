"use client";

import { useMenuPresence } from "@/hooks/usePresence";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FilterIcon } from "./icons";

/** Kept for pages that still lay out their own dropdowns: a full row on a phone, a fixed size from tablet up. */
export const FILTER_SELECT_CLASS = "min-w-0 flex-1 basis-36 sm:flex-none sm:basis-44";

const chevron = (open: boolean) => (
  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Closes a popup on a click outside `ref` and on Esc. */
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
    // `close` only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

type FilterBarProps = {
  /** The search box (leads the row; omit on pages without a list to search). */
  search?: ReactNode;
  /** How many filters are narrowing the list; 0 hides "Clear all". */
  activeCount: number;
  onClear: () => void;
  /** The everyday filters, most used first: `FilterPill`s and `FilterSegments`. */
  children: ReactNode;
  /** Less used filters (date ranges ...), kept behind a "More" button; the button shows how many of them are on. */
  advanced?: ReactNode;
  advancedCount?: number;
  /** The number of matching records, shown at the right of the row. */
  count?: { shown: number; total: number };
  /** A short line under the row (what a filter covers). */
  note?: ReactNode;
  /** The name screen readers hear for the region (default "Search and filters"). */
  label?: string;
};

/**
 * The one filter toolbar every list page uses: search, then compact filter pills (each shows its choice and clears itself with the x), a "More" button for the less used
 * filters, "Clear all" and the count of matches. Small screens fold the pills behind one "Filter" button and open them as a panel under the row.
 */
export default function FilterBar({ search, activeCount, onClear, children, advanced, advancedCount = 0, count, note, label = "Search and filters" }: FilterBarProps) {
  const [panel, setPanel] = useState(false);
  const [more, setMore] = useState(false);
  const moreMenu = useMenuPresence(more);
  const moreBox = useRef<HTMLDivElement>(null);
  useDismiss(more, () => setMore(false), moreBox);
  const active = activeCount > 0;
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 md:[&_.field]:h-9">
        {search && <div className="flex min-w-0 flex-1 basis-48 md:max-w-72 md:flex-none md:basis-72">{search}</div>}
        <button
          type="button"
          onClick={() => setPanel((o) => !o)}
          aria-expanded={panel}
          className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent md:hidden ${
            panel || active ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-muted hover:bg-hover hover:text-foreground"
          }`}
        >
          <FilterIcon width={16} height={16} />
          Filter
          {active && <span className="grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-white">{activeCount}</span>}
          {chevron(panel)}
        </button>
        <div className={`${panel ? "flex" : "hidden"} w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2.5 md:contents`}>
          {children}
          {advanced && (
            <div ref={moreBox} className="relative">
              <button
                type="button"
                onClick={() => setMore((o) => !o)}
                aria-expanded={more}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  more || advancedCount > 0 ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-muted hover:bg-hover hover:text-foreground"
                }`}
              >
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
                  <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
                </svg>
                More
                {advancedCount > 0 && <span className="grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-white">{advancedCount}</span>}
                {chevron(more)}
              </button>
              {moreMenu.mounted && (
                <div role="dialog" aria-label="More filters" className={`${moreMenu.motion} absolute left-0 top-full z-30 mt-1.5 flex w-max max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-menu`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">More filters</p>
                  <div className="flex flex-wrap items-center gap-2">{advanced}</div>
                </div>
              )}
            </div>
          )}
          {active && (
            <button
              type="button"
              onClick={onClear}
              className="h-9 shrink-0 rounded-lg px-2.5 text-sm font-medium text-accent transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
            >
              Clear all
            </button>
          )}
        </div>
        {count && (
          <p role="status" aria-live="polite" className="ml-auto shrink-0 text-xs text-muted">
            <span className="font-semibold tabular-nums text-foreground">{count.shown}</span> of {count.total} {count.total === 1 ? "result" : "results"}
          </p>
        )}
      </div>
      {note && <p className="px-1 text-xs text-muted">{note}</p>}
    </section>
  );
}

type PillOption = string | { value: string; label: string };

/**
 * A compact filter: shows "Label" until a choice is made, then "Label: Choice" in the accent colour with an x that clears it. The menu is searchable when it has many
 * choices and works with the arrow keys; a click outside it or Esc closes it. The value is one of the options ("" = no filter).
 */
export function FilterPill({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly PillOption[] }) {
  const [open, setOpen] = useState(false);
  const pill = useMenuPresence(open);
  const [query, setQuery] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), box);
  // Opened (by mouse or keys), the focus moves into the menu: the search box, or else the chosen / first choice, so the arrow keys work at once.
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>("input, [aria-selected=true], [role=option]")?.focus();
  }, [open]);
  const items = useMemo(() => options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)), [options]);
  const chosen = items.find((o) => o.value === value);
  const searchable = items.length > 7;
  const shown = searchable && query ? items.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : items;
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  };
  const move = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") trigger.current?.focus();
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const all = [...(menu.current?.querySelectorAll<HTMLElement>("input, button") ?? [])];
    const at = all.indexOf(document.activeElement as HTMLElement);
    all[Math.min(all.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))]?.focus();
    e.preventDefault();
  };
  return (
    <div ref={box} className="relative">
      <span className={`inline-flex h-9 items-center rounded-lg border transition-colors ${chosen ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-muted hover:bg-hover hover:text-foreground"}`}>
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            // The Down (or Up) arrow opens the menu, as on any dropdown.
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex h-full max-w-48 items-center gap-1.5 rounded-lg pl-2.5 pr-2 text-sm focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="truncate">
            {label}
            {chosen && <span className="font-semibold">: {chosen.label}</span>}
          </span>
          {!chosen && chevron(open)}
        </button>
        {chosen && (
          <button type="button" onClick={() => pick("")} aria-label={`Clear ${label} filter`} className="mr-1 grid size-6 place-items-center rounded-md hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-accent">
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
              <path d="m7 7 10 10M17 7 7 17" />
            </svg>
          </button>
        )}
      </span>
      {pill.mounted && (
        <div ref={menu} onKeyDown={move} className={`${pill.motion} absolute left-0 top-full z-30 mt-1.5 flex w-56 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-border bg-surface p-1 shadow-menu`}>
          {searchable && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              aria-label={`Search ${label}`}
              className="mb-1 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none placeholder:text-muted focus:border-[var(--brand-to)]"
            />
          )}
          <div role="listbox" aria-label={label} className="max-h-60 overflow-y-auto">
            <button type="button" role="option" aria-selected={!chosen} onClick={() => pick("")} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent ${!chosen ? "font-medium text-accent" : "text-muted"}`}>
              Any {label.toLowerCase()}
            </button>
            {shown.map((o) => (
              <button key={o.value} type="button" role="option" aria-selected={o.value === value} onClick={() => pick(o.value)} className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent ${o.value === value ? "bg-accent-soft font-medium text-accent" : ""}`}>
                <span className="truncate">{o.label}</span>
                {o.value === value && (
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                )}
              </button>
            ))}
            {shown.length === 0 && <p className="px-2.5 py-2 text-sm text-muted">No matches.</p>}
          </div>
        </div>
      )}
    </div>
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
    <div role="group" aria-label={label} className="flex h-9 shrink-0 items-center rounded-xl border border-border bg-background p-0.5">
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
