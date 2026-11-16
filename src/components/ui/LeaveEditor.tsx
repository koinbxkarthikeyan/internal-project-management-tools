"use client";

import { useEffect, useRef, useState } from "react";
import { EditIcon, TrashIcon } from "@/components/ui/icons";
import MultiDatePicker from "@/components/ui/MultiDatePicker";
import { isWeekend } from "@/features/work/utils";

export type LeaveRow = { id: string; date: string; name?: string; /** Hours off that day; left out = the whole day. */ hours?: number };

const input = "field h-9 min-w-0 px-3 text-sm";
const btn = "h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent";
const ghost = `${btn} text-muted hover:bg-hover hover:text-foreground`;
const icon = "rounded-md p-1.5 text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent";

const dayText = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const prettyDay = (iso: string) => dayText.format(new Date(`${iso}T00:00:00Z`));

/** The two kinds, told apart by colour and word: a sprint's common leave (everyone) and a person's own leave. */
export const LEAVE_TAG = {
  common: { label: "Common leave", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  personal: { label: "My leave", cls: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
} as const;

export const LeaveTag = ({ kind }: { kind: keyof typeof LEAVE_TAG }) => (
  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${LEAVE_TAG[kind].cls}`}>{LEAVE_TAG[kind].label}</span>
);

type LeaveEditorProps = {
  kind: keyof typeof LEAVE_TAG;
  rows: LeaveRow[];
  /** Add / edit / delete are hidden and the list is read-only when false (not allowed to, or the sprint is closed). */
  canEdit: boolean;
  /** An optional name per date (common leave); personal leave is a date alone. */
  named?: boolean;
  /** Dates the picker allows (the sprint's own days). */
  min?: string;
  max?: string;
  addLabel: string;
  empty: string;
  /** Each returns an error text, or undefined when done (it may be saved on a server first, so they may return a promise). */
  onAdd: (date: string, name: string, hours?: number) => string | undefined | Promise<string | undefined>;
  /** Leave out where a saved date can't be changed (it is removed and added again): the pencil is then not shown. */
  onEdit?: (id: string, date: string, name: string, hours?: number) => string | undefined;
  onRemove: (id: string) => void | Promise<void>;
};

/**
 * A compact list of leave dates with a date picker to add, and edit/delete in place. Used in the sprint form, the active sprint and My Sprint.
 * It holds no <form> (it sits inside drawers that are forms): Enter in a field presses its Add or Save.
 */
export default function LeaveEditor({ kind, rows, canEdit, named = false, min, max, addLabel, empty, onAdd, onEdit, onRemove }: LeaveEditorProps) {
  const [draft, setDraft] = useState<{ dates: string[]; name: string; hours: string }>({ dates: [], name: "", hours: "" });
  const [editing, setEditing] = useState<{ id: string; date: string; name: string; hours: string } | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pop, setPop] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  // The calendar popup closes on a click anywhere outside it (and its field), and on Esc.
  useEffect(() => {
    if (!pop) return;
    const away = (e: PointerEvent) => !row.current?.contains(e.target as Node) && setPop(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setPop(false));
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [pop]);
  const reset = () => (setEditing(null), setAsking(null), setError(""), setDraft({ dates: [], name: "", hours: "" }), setPop(false));
  const enter = (run: () => void) => (e: React.KeyboardEvent) => e.key === "Enter" && (e.preventDefault(), e.stopPropagation(), run());

  // Empty = the whole day off; otherwise 0.5 to 6 hours off (a part day).
  const parse = (text: string): { hours?: number } | string => {
    if (!text.trim()) return {};
    const h = Number(text);
    return h > 0 && h <= 6 ? { hours: h } : "Hours off: 0.5 to 6, or leave empty for the whole day.";
  };
  const [busy, setBusy] = useState(false);
  const add = async () => {
    const h = parse(draft.hours);
    if (typeof h === "string") return setError(h);
    // Every picked day is added; a day that cannot be (outside the sprint, or already there) is skipped.
    setBusy(true);
    const errors: (string | undefined)[] = [];
    for (const d of draft.dates) errors.push(await onAdd(d, draft.name, h.hours));
    setBusy(false);
    const added = errors.filter((e) => !e).length;
    if (added === 0) return setError(errors[0] ?? "Pick at least one day.");
    reset();
  };
  const save = () => {
    if (!editing) return;
    const h = parse(editing.hours);
    if (typeof h === "string") return setError(h);
    const err = onEdit?.(editing.id, editing.date, editing.name, h.hours);
    if (err) setError(err);
    else reset();
  };

  return (
    <div className="flex flex-col gap-2">
      {canEdit && (
        <div className="flex flex-col gap-1.5">
          {/* One row everywhere: the days field opens the calendar as a popup over the page, so nothing grows. */}
          <div ref={row} className="relative flex flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPop((o) => !o)}
              aria-expanded={pop}
              aria-haspopup="dialog"
              className={`${input} w-36 shrink-0 truncate text-left ${draft.dates.length ? "" : "text-muted"}`}
            >
              {draft.dates.length ? `${draft.dates.length} day${draft.dates.length === 1 ? "" : "s"} selected` : "Select days…"}
            </button>
            {!named && <input type="number" min={0.5} max={6} step={0.5} value={draft.hours} onChange={(e) => (setDraft({ ...draft, hours: e.target.value }), setError(""))} onKeyDown={enter(add)} placeholder="Hours off" title="Hours off (empty = the whole day)" aria-label="Hours off (empty = the whole day)" className={`${input} w-28 shrink-0`} />}
            {named && <input value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={enter(add)} placeholder="Note (optional)" aria-label="Description" className={`${input} min-w-0 flex-1`} />}
            <button type="button" onClick={add} disabled={draft.dates.length === 0 || busy} aria-label={addLabel} title={addLabel} className={`${btn} btn-brand font-semibold disabled:opacity-50`}>Add</button>
            {pop && (
              <div role="dialog" aria-label="Select leave days" className="absolute bottom-full left-0 z-30 mb-1 rounded-xl border border-border bg-surface p-2 shadow-menu">
                <MultiDatePicker value={draft.dates} onChange={(dates) => (setDraft({ ...draft, dates }), setError(""))} min={min} max={max} taken={new Set(rows.map((r) => r.date))} compact />
                <div className="mt-1 flex items-center justify-between gap-3 px-1">
                  <span className="text-xs text-muted">{draft.dates.length ? `${draft.dates.length} selected` : "Click days to select"}</span>
                  <span className="flex gap-1">
                    {draft.dates.length > 0 && <button type="button" onClick={() => setDraft({ ...draft, dates: [] })} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-hover">Clear</button>}
                    <button type="button" onClick={() => setPop(false)} className="rounded-md px-3 py-1 text-xs font-medium text-accent hover:bg-hover">Done</button>
                  </span>
                </div>
              </div>
            )}
          </div>
          {error && !editing && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{error}</p>}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {rows.map((r) =>
            editing?.id === r.id ? (
              <li key={r.id} className="flex flex-col gap-1.5 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" min={min} max={max} value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} onKeyDown={enter(save)} aria-label="Leave date" className={`${input} w-40`} />
                  {!named && <input type="number" min={0.5} max={6} step={0.5} value={editing.hours} onChange={(e) => setEditing({ ...editing, hours: e.target.value })} onKeyDown={enter(save)} placeholder="Hours off" title="Hours off (empty = the whole day)" aria-label="Hours off (empty = the whole day)" className={`${input} w-24 shrink-0`} />}
                  {named && <input value={editing.name} maxLength={80} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={enter(save)} placeholder="Description (optional)" aria-label="Description" className={`${input} min-w-36 flex-1`} />}
                  <button type="button" onClick={save} className={`${btn} text-accent hover:bg-hover`}>Save</button>
                  <button type="button" onClick={reset} className={ghost}>Cancel</button>
                </div>
                {error && <p role="alert" className="text-xs text-red-600 dark:text-red-300">{error}</p>}
              </li>
            ) : asking === r.id ? (
              <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">Remove {prettyDay(r.date)}?</span>
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => (onRemove(r.id), reset())} className={`${btn} text-red-600 hover:bg-hover dark:text-red-300`}>Remove</button>
                  <button type="button" onClick={reset} className={ghost}>Cancel</button>
                </span>
              </li>
            ) : (
              <li key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <LeaveTag kind={kind} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium tabular-nums">{prettyDay(r.date)}</span>
                  {!named && r.hours ? <span className="text-muted"> · {r.hours}h off</span> : null}
                  {r.name ? <span className="text-muted"> · {r.name}</span> : null}
                  {isWeekend(r.date) && <span className="text-xs text-muted"> · weekend, already 0h</span>}
                </span>
                {canEdit && (
                  <span className="flex shrink-0">
                    <button type="button" onClick={() => (reset(), setEditing({ id: r.id, date: r.date, name: r.name ?? "", hours: r.hours ? String(r.hours) : "" }))} hidden={!onEdit} aria-label={`Edit ${prettyDay(r.date)}`} title="Edit" className={icon}><EditIcon /></button>
                    <button type="button" onClick={() => (reset(), setAsking(r.id))} aria-label={`Remove ${prettyDay(r.date)}`} title="Remove" className={`${icon} hover:text-red-600 dark:hover:text-red-300`}><TrashIcon /></button>
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
