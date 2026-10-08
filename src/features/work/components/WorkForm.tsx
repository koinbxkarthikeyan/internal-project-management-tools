"use client";

import { useEffect, useState, type FormEvent } from "react";
import { TextAreaField, TextField } from "@/components/ui/FormControls";
import { CloseIcon } from "@/components/ui/icons";
import { FOCUS_HOURS_PER_DAY, HOUR_PRESETS, WORK_KINDS, isPseudoPod } from "@/constants/work";
import type { BacklogItemData, Sprint } from "@/types/backlog";
import type { Pod, WorkEntry, WorkEntryInput, WorkKind } from "@/types/work";
import { addDays, plannedHours, workingDays } from "../utils";

type WorkFormProps = {
  /** The sprint the time is logged against (its dates bound From and To). */
  sprint: Sprint & { start: string; end: string };
  /** The POD of the ticked tasks, if any are ticked. */
  pod: Pod | null;
  /** The tasks ticked above. */
  tasks: readonly BacklogItemData[];
  /** Who the work is logged for; empty until they pick their name. */
  person: string;
  /** Entry being changed, or null when adding a new one. */
  editing: WorkEntry | null;
  today: string;
  /** The sprint is closed: time can't be logged against it. */
  closed?: boolean;
  /** Called with the hours in the field once the dates or hours have been changed (null until then), so the sprint bar can follow them. */
  onHoursChange?: (hours: number | null) => void;
  onRemoveTask: (item: BacklogItemData) => void;
  onSubmit: (input: WorkEntryInput) => Promise<boolean>;
  onCancelEdit: () => void;
};

const chip =
  "rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

const clamp = (d: string, min: string, max: string) => (d < min ? min : d > max ? max : d);

export default function WorkForm({ sprint, pod, tasks, person, editing, today, closed = false, onHoursChange, onRemoveTask, onSubmit, onCancelEdit }: WorkFormProps) {
  const [kind, setKind] = useState<WorkKind>(editing?.kind ?? WORK_KINDS[0]);
  const [from, setFrom] = useState(editing?.from ?? sprint.start);
  // Hours can only be logged up to today; days still to come are not offered.
  const lastLoggable = clamp(today, sprint.start, sprint.end);
  const latest = editing && editing.to > lastLoggable ? editing.to : lastLoggable;
  const [to, setTo] = useState(editing?.to ?? lastLoggable);
  const [hours, setHours] = useState(String(editing?.hours ?? 0));
  // Once the user types their own hours, changing the dates no longer rewrites them.
  const [hoursTouched, setHoursTouched] = useState(!!editing);
  // Set once the dates or hours are changed; until then the form holds only its defaults.
  const [changed, setChanged] = useState(false);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onHoursChange?.(changed ? (Number(hours) > 0 ? Number(hours) : 0) : null);
  }, [hours, changed, onHoursChange]);

  function setRange(f: string, t: string) {
    setChanged(true);
    setFrom(f);
    setTo(t);
    setError("");
    if (!hoursTouched) setHours(String(plannedHours(f, t)));
  }

  const setPreset = (h: number) => (setHours(String(h)), setHoursTouched(true), setChanged(true));
  const clampedToday = lastLoggable;
  const week2Start = addDays(sprint.start, 7);
  const wd = workingDays(from, to);
  const full = plannedHours(from, to);

  // An older entry (logged before tasks were picked from the list) keeps its task text and POD when edited.
  const legacy = !!editing && !editing.itemIds?.length;
  const hasTasks = tasks.length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (closed) return setError(`${sprint.name} is closed, so time can't be logged against it.`);
    if (!person) return setError("Pick your name first.");
    if (!hasTasks && !legacy) return setError("Tick at least one task above.");
    if (today < sprint.start) return setError(`${sprint.name} hasn't started yet, so there is nothing to log.`);
    if (to < from) return setError("To can't be before From.");
    if (to > latest) return setError("You can't log hours for days that haven't happened yet.");
    const h = Number(hours);
    if (!(h >= 0)) return setError("Hours can't be negative.");

    setSaving(true);
    const ok = await onSubmit({
      sprintId: sprint.id,
      person,
      pod: hasTasks ? (pod?.name ?? "") : (editing?.pod ?? ""),
      // Unplanned tasks aren't in a POD, so no POD id is saved for them.
      podId: hasTasks ? (isPseudoPod(pod?.id) ? undefined : pod?.id) : editing?.podId,
      itemIds: hasTasks ? tasks.map((t) => t.id) : undefined,
      task: hasTasks ? tasks.map((t) => t.title).join(", ") : (editing?.task ?? ""),
      kind,
      from,
      to,
      hours: h,
      notes: notes.trim(),
    });
    setSaving(false);
    if (!ok) setError("Couldn't save. Please try again.");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">
          Tasks <span className="text-red-500">*</span>
        </p>
        {hasTasks ? (
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-xs text-muted">
              {pod?.name} · {sprint.name}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-1.5 rounded-lg bg-accent-soft py-1 pl-2.5 pr-1 text-sm text-accent">
                  <span className="max-w-60 truncate">{t.title}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveTask(t)}
                    aria-label={`Remove ${t.title}`}
                    className="rounded p-0.5 hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <CloseIcon width={12} height={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : legacy ? (
          <p className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
            {editing?.task} <span className="text-xs text-muted">· {editing?.pod}</span>
          </p>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted">
            Nothing ticked yet. Tick the tasks you&apos;re working on in the list above.
          </p>
        )}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-muted">Kind of work</legend>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1 sm:grid-cols-5">
          {WORK_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                kind === k ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField label="From" type="date" required min={sprint.start} max={latest} value={from} onChange={(v) => setRange(v, to)} />
        <TextField label="To" type="date" required min={from || sprint.start} max={latest} value={to} onChange={(v) => setRange(from, v)} />
        <TextField
          label="Hours in total"
          type="number"
          min="0"
          step="0.25"
          value={hours}
          onChange={(v) => (setHours(v), setHoursTouched(true), setChanged(true), setError(""))}
        />
      </div>
      <p className="-mt-2 text-xs text-muted">
        {wd} working {wd === 1 ? "day" : "days"} · a full stretch is {full}h — change if you were on other things too
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip} onClick={() => setRange(sprint.start, lastLoggable)}>
          Sprint so far
        </button>
        <button type="button" className={chip} onClick={() => setRange(sprint.start, clamp(addDays(sprint.start, 6), sprint.start, lastLoggable))}>
          Week 1
        </button>
        <button type="button" className={chip} disabled={week2Start > lastLoggable} onClick={() => setRange(week2Start, lastLoggable)}>
          Week 2
        </button>
        <button type="button" className={chip} onClick={() => setRange(clampedToday, clampedToday)}>
          Just today
        </button>
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
        {HOUR_PRESETS.map((p) => (
          <button key={p.label} type="button" className={chip} onClick={() => setPreset(p.hours)} title={`${p.hours}h (${FOCUS_HOURS_PER_DAY}h = a day)`}>
            {p.label}
          </button>
        ))}
      </div>

      <TextAreaField
        label="Anything worth knowing? (optional — blockers, what's next, who you need)"
        value={notes}
        onChange={setNotes}
        placeholder="e.g. Waiting on PayU prod credentials · Kill switch config done, pricing next"
      />

      {closed && (
        <p role="note" className="rounded-xl border border-border bg-hover px-3 py-2 text-sm text-muted">
          {sprint.name} is closed. Select the running sprint above to log time.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={saving || closed}
          className="h-11 w-full shrink-0 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto sm:flex-1"
        >
          {saving ? "Saving…" : editing ? "Save changes" : "Add to my sprint"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="h-11 shrink-0 rounded-xl border border-border px-4 text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
