"use client";

import { useState } from "react";
import { isWeekend } from "@/features/work/utils";

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

type Props = {
  /** The picked dates (ISO). */
  value: string[];
  onChange: (value: string[]) => void;
  /** The days that can be picked (the sprint's own days). */
  min?: string;
  max?: string;
  /** Days that already have leave: shown, but not pickable again. */
  taken?: ReadonlySet<string>;
  /** Only the calendar (the picked days are shown by the caller): for a popup. */
  compact?: boolean;
};

/**
 * A small month calendar where any number of separate days are clicked on and off (weekends are already 0 hours, so they can't be picked), with the picked
 * days listed on the right (each removable). Months move with the arrows, within the allowed range.
 */
export default function MultiDatePicker({ value, onChange, min, max, taken, compact = false }: Props) {
  const start = min ?? new Date().toISOString().slice(0, 10);
  const [view, setView] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const first = new Date(Date.UTC(view.y, view.m, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(view.y, view.m, i + 1))] as (string | null)[];
  const monthOf = (y: number, m: number) => iso(y, m, 1).slice(0, 7);
  const canPrev = !min || monthOf(view.y, view.m) > min.slice(0, 7);
  const canNext = !max || monthOf(view.y, view.m) < max.slice(0, 7);
  const move = (by: number) => setView(({ y, m }) => ({ y: y + Math.floor((m + by) / 12), m: (((m + by) % 12) + 12) % 12 }));
  const toggle = (d: string) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  const sorted = [...value].sort();

  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="w-56 shrink-0 rounded-xl border border-border bg-background p-2">
        <div className="mb-1 flex items-center justify-between">
          <button type="button" onClick={() => move(-1)} disabled={!canPrev} aria-label="Previous month" className="rounded-md px-2 py-0.5 text-muted hover:bg-hover disabled:opacity-30">‹</button>
          <span className="text-xs font-medium">{MONTH.format(first)}</span>
          <button type="button" onClick={() => move(1)} disabled={!canNext} aria-label="Next month" className="rounded-md px-2 py-0.5 text-muted hover:bg-hover disabled:opacity-30">›</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
          {WEEK.map((w) => (
            <span key={w} className="py-0.5 text-muted">{w}</span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`b${i}`} />;
            const out = (!!min && d < min) || (!!max && d > max);
            const off = out || isWeekend(d) || !!taken?.has(d);
            const on = value.includes(d);
            return (
              <button
                key={d}
                type="button"
                disabled={off}
                aria-pressed={on}
                aria-label={SHORT.format(new Date(`${d}T00:00:00Z`))}
                onClick={() => toggle(d)}
                className={`h-7 rounded-md text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  on ? "bg-accent font-semibold text-white" : taken?.has(d) ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : off ? "text-muted/40" : "hover:bg-hover"
                }`}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
      </div>
      {!compact && (
      <div className="flex min-w-28 flex-1 flex-col gap-1 text-xs">
          <span className="font-medium text-muted">{sorted.length ? `${sorted.length} selected` : "Click days to select"}</span>
          <ul className="flex max-h-44 flex-col gap-0.5 overflow-y-auto">
            {sorted.map((d) => (
              <li key={d} className="flex items-center justify-between gap-2 rounded-md bg-accent-soft px-2 py-1 text-accent">
                {SHORT.format(new Date(`${d}T00:00:00Z`))}
                <button type="button" onClick={() => toggle(d)} aria-label={`Unselect ${d}`} className="opacity-70 hover:opacity-100">×</button>
              </li>
            ))}
          </ul>
          {sorted.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="w-fit text-muted underline-offset-2 hover:underline">Clear selection</button>
          )}
        </div>
  
      )}
    </div>
  );
}
