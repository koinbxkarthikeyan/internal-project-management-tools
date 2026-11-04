"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DisabledTip } from "@/components/ui/DisabledTip";
import { TextAreaField, TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { checkRequiredFields, clearFilled } from "@/lib/formValidation";
import { CloseIcon } from "@/components/ui/icons";
import { FOCUS_HOURS_PER_DAY, HOUR_PRESETS, isPseudoPod } from "@/constants/work";
import type { BacklogItemData, Sprint } from "@/types/backlog";
import type { Pod, WorkEntry, WorkEntryInput, WorkKind } from "@/types/work";
import { addDays, plannedHours, workingDays } from "../utils";
import { FieldError } from "@/components/ui/FieldError";
import KindTabs from "./KindTabs";

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
  /** Called with what is in the form (its dates and hours) as it changes, so the hours bar and timeline on the page can follow it. */
  onDraftChange?: (draft: { from: string; to: string; hours: number }) => void;
  onRemoveTask: (item: BacklogItemData) => void;
  onSubmit: (input: WorkEntryInput) => Promise<boolean>;
  onCancelEdit: () => void;
  /** The person has no Team yet: it is picked at the top of the page first. */
  /** The kind of work for the entry, chosen in the form (it starts as the kind that matches the person's Team). */
  /** Every kind that can be picked (the team list), shown as tabs left to right; a long list scrolls sideways. */
  kinds: readonly string[];
  kind: WorkKind | null;
  onKindChange: (kind: WorkKind) => void;
  /** "Other Work" is ticked: the entry has a short description instead of tasks. */
  otherWork?: boolean;
};

const chip =
  "rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

const NEEDS_TASK = "Select a task, or choose “Something else - my own task”, to enable this.";
const KIND_REQUIRED = "Choose the kind of work.";

const clamp = (d: string, min: string, max: string) => (d < min ? min : d > max ? max : d);

export default function WorkForm({ sprint, pod, tasks, person, editing, today, closed = false, onDraftChange, onRemoveTask, onSubmit, onCancelEdit, kinds, kind: pickedKind, onKindChange, otherWork = false }: WorkFormProps) {
  const toast = useToast();
  // An entry being changed keeps its own kind unless it is changed here; a new one uses the chosen kind.
  const kind = pickedKind;
  const [from, setFrom] = useState(editing?.from ?? sprint.start);
  // Hours can only be logged up to today; days still to come are not offered.
  const lastLoggable = clamp(today, sprint.start, sprint.end);
  const latest = editing && editing.to > lastLoggable ? editing.to : lastLoggable;
  const [to, setTo] = useState(editing?.to ?? lastLoggable);
  const [hours, setHours] = useState(String(editing?.hours ?? 0));
  // Once the user types their own hours, changing the dates no longer rewrites them.
  const [hoursTouched, setHoursTouched] = useState(!!editing);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [details, setDetails] = useState(editing?.otherWork ? editing.task : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onDraftChange?.({ from, to, hours: Number(hours) > 0 ? Number(hours) : 0 });
  }, [from, to, hours, onDraftChange]);

  function setRange(f: string, t: string) {
    setFrom(f);
    setTo(t);
    setError("");
    if (!hoursTouched) setHours(String(plannedHours(f, t)));
  }

  const setPreset = (h: number) => (setHours(String(h)), setHoursTouched(true));
  const clampedToday = lastLoggable;
  const week2Start = addDays(sprint.start, 7);
  const wd = workingDays(from, to);
  const full = plannedHours(from, to);

  // An older entry (logged before tasks were picked from the list) keeps its task text and POD when edited.
  const legacy = !!editing && !editing.itemIds?.length && !editing.otherWork;
  const hasTasks = tasks.length > 0 && !otherWork;
  // Hours can be entered once there is something to log them against: a ticked task, or Other Work.
  const canLog = hasTasks || legacy || otherWork;

  // Changing an entry: Save stays off until something differs from what was saved.
  const sameTasks = (editing?.itemIds ?? []).join("|") === tasks.map((t) => t.id).join("|");
  const unchanged =
    !!editing &&
    from === editing.from &&
    to === editing.to &&
    Number(hours) === editing.hours &&
    notes.trim() === (editing.notes ?? "").trim() &&
    kind === editing.kind &&
    (editing.otherWork ? otherWork && details.trim() === editing.task.trim() : !otherWork && (legacy || sameTasks));

  // The button stays off until every mandatory field is filled; the tip names what is still missing.
  const missing = [
    !person && "your name",
    !canLog && "a task (or Something else)",
    otherWork && !details.trim() && "the work details",
    !kind && "the kind of work",
    (!from || !to) && "the dates",
    !(Number(hours) > 0) && "the hours",
  ].filter((m): m is string => !!m);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    if (!checkRequiredFields(e.currentTarget, toast.show)) return;
    if (!kind) return setError(KIND_REQUIRED);
    if (closed) return setError(`${sprint.name} is closed, so time can't be logged against it.`);
    if (!person) return setError("Pick your name first.");
    if (!canLog) return setError("Tick at least one task above, or choose Something else - my own task.");
    if (otherWork && !details.trim()) return setError("Enter the work details.");
    if (today < sprint.start) return setError(`${sprint.name} hasn't started yet, so there is nothing to log.`);
    if (to < from) return setError("To can't be before From.");
    if (to > latest) return setError("You can't log hours for days that haven't happened yet.");
    const h = Number(hours);
    if (!(h >= 0)) return setError("Hours can't be negative.");

    setSaving(true);
    const ok = await onSubmit({
      sprintId: sprint.id,
      person,
      pod: otherWork ? "Something else" : hasTasks ? (pod?.name ?? "") : (editing?.pod ?? ""),
      // Unplanned tasks aren't in a POD, so no POD id is saved for them.
      podId: otherWork ? undefined : hasTasks ? (isPseudoPod(pod?.id) ? undefined : pod?.id) : editing?.podId,
      itemIds: hasTasks ? tasks.map((t) => t.id) : undefined,
      ...(otherWork ? { otherWork: true } : {}),
      task: otherWork ? details.trim() : hasTasks ? tasks.map((t) => t.title).join(", ") : (editing?.task ?? ""),
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
    <form noValidate onSubmit={handleSubmit} onInput={(e) => clearFilled(e.currentTarget)} className="flex flex-col gap-4">
      {otherWork ? (
        <TextField
          label="Work details"
          required
          value={details}
          onChange={(v) => (setDetails(v), setError(""))}
          placeholder="Enter work details (e.g., Code Review, Meeting, Bug Investigation)"
        />
      ) : (
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
      )}

      <fieldset className="min-w-0">
        <legend className="mb-1.5 text-xs font-medium text-muted">
          Kind of work
          <span aria-hidden="true" className="text-red-500">
            {" "}
            *
          </span>
        </legend>
        <DisabledTip reason={!canLog && NEEDS_TASK} className="block">
          <KindTabs kinds={kinds} value={kind} onChange={onKindChange} invalid={!kind && error === KIND_REQUIRED} disabled={!canLog} />
        </DisabledTip>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField label="From" type="date" required disabled={!canLog} disabledReason={NEEDS_TASK} min={sprint.start} max={latest} value={from} onChange={(v) => setRange(v, to)} />
        <TextField label="To" type="date" required disabled={!canLog} disabledReason={NEEDS_TASK} min={from || sprint.start} max={latest} value={to} onChange={(v) => setRange(from, v)} />
        <TextField
          label="Hours in total"
          type="number"
          min="0"
          step="0.25"
          disabled={!canLog}
          disabledReason={NEEDS_TASK}
          value={hours}
          onChange={(v) => (setHours(v.replace(/^0+(?=\d)/, "")), setHoursTouched(true), setError(""))}
        />
      </div>
      <p className="-mt-2 text-xs text-muted">
        {wd} working {wd === 1 ? "day" : "days"} · a full stretch is {full}h — change if you were on other things too
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <DisabledTip reason={!canLog && NEEDS_TASK} className="inline-block">
          <button type="button" className={chip} disabled={!canLog} onClick={() => setRange(sprint.start, lastLoggable)}>
            Sprint so far
          </button>
        </DisabledTip>
        <DisabledTip reason={!canLog && NEEDS_TASK} className="inline-block">
          <button type="button" className={chip} disabled={!canLog} onClick={() => setRange(sprint.start, clamp(addDays(sprint.start, 6), sprint.start, lastLoggable))}>
            Week 1
          </button>
        </DisabledTip>
        <DisabledTip reason={(!canLog && NEEDS_TASK) || (week2Start > lastLoggable && "Week 2 hasn't started yet.")} className="inline-block">
          <button type="button" className={chip} disabled={!canLog || week2Start > lastLoggable} onClick={() => setRange(week2Start, lastLoggable)}>
            Week 2
          </button>
        </DisabledTip>
        <DisabledTip reason={!canLog && NEEDS_TASK} className="inline-block">
          <button type="button" className={chip} disabled={!canLog} onClick={() => setRange(clampedToday, clampedToday)}>
            Just today
          </button>
        </DisabledTip>
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
        {HOUR_PRESETS.map((p) => (
          <DisabledTip key={p.label} reason={!canLog && NEEDS_TASK} className="inline-block">
            <button type="button" className={chip} disabled={!canLog} onClick={() => setPreset(p.hours)} title={canLog ? `${p.hours}h (${FOCUS_HOURS_PER_DAY}h = a day)` : undefined}>
              {p.label}
            </button>
          </DisabledTip>
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
        <FieldError>
          {error}
        </FieldError>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <DisabledTip reason={!saving && (closed ? `${sprint.name} is closed. Select the running sprint to log time.` : unchanged ? "No changes to save." : missing.length > 0 && `Fill in ${missing.join(", ")} first.`)} className="flex w-full sm:flex-1">
        <button
          type="submit"
          disabled={saving || closed || unchanged || missing.length > 0}
          className="h-11 w-full shrink-0 rounded-xl btn-brand px-4 text-sm font-semibold  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto sm:flex-1"
        >
          {saving ? "Saving…" : editing ? "Save changes" : "Add to my sprint"}
        </button>
        </DisabledTip>
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
