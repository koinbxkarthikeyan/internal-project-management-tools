"use client";

import { useState } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { SelectField } from "@/components/ui/FormControls";
import { StatusBadge } from "@/components/ui/Badge";
import type { CloseChoices } from "@/services/sprintService";
import type { BacklogItemData, Sprint } from "@/types/backlog";
import BacklogDrawer from "./BacklogDrawer";

type CloseSprintDrawerProps = {
  sprint: Sprint;
  /** The planned sprints that could be started right after this one closes. */
  planned: readonly Sprint[];
  /** The sprint's tasks that are not Done: each one gets a choice of what happens to it when the sprint closes. */
  unfinished: readonly BacklogItemData[];
  /** Runs the close with the choices (task API id → what happens to it), and starts `startNext` straight after when one was chosen. Return `false` to keep the panel open (e.g. the request failed). */
  onConfirm: (startNext: Sprint | undefined, choices: CloseChoices) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
};

/** Side panel to confirm closing (completing) the running sprint. */
const CHOICES: { value: CloseChoices[string]; label: string }[] = [
  { value: "carry", label: "Carry over" },
  { value: "backlog", label: "Move to Backlog" },
  { value: "done", label: "Mark Done" },
];

export default function CloseSprintDrawer({ sprint, planned, unfinished, onConfirm, onClose }: CloseSprintDrawerProps) {
  const [error, setError] = useState("");
  const [startNow, setStartNow] = useState(false);
  const [nextId, setNextId] = useState(planned[0]?.id ?? "");
  // What happens to each unfinished task (a Ticket follows its task). Carried over, unless chosen otherwise.
  const [choices, setChoices] = useState<CloseChoices>({});
  const tasks = unfinished.filter((t) => t.type !== "Ticket");
  const choiceOf = (t: BacklogItemData) => choices[String(t.apiId)] ?? "carry";

  // A failed close leaves everything as it was.
  async function confirm() {
    setError("");
    const ok = await onConfirm(startNow ? planned.find((s) => s.id === nextId) : undefined, choices);
    if (ok === false) setError("The sprint was not closed. Nothing was changed.");
    return ok;
  }

  return (
    <BacklogDrawer heading="Close sprint" subtitle="Choose what happens to each unfinished task." submitLabel="Confirm Close Sprint" onSubmit={confirm} onClose={onClose} compact>
      <div role="alertdialog" aria-label="Close sprint" className="flex flex-col gap-2">
        <p className="text-sm">
          Are you sure you want to close <strong className="font-semibold">{sprint.name}</strong>?
        </p>
        <p className="text-sm text-muted">
          The sprint ends today and can&apos;t be reopened. Its tasks and logged hours stay as history.
        </p>
      </div>

      {tasks.length > 0 ? (
        <section aria-label="Unfinished tasks" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Unfinished tasks ({tasks.length})</h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate text-sm font-medium">{t.title}</span>
                  <span className="flex items-center gap-2 text-xs text-muted"><span className="font-mono">{t.id}</span><StatusBadge status={t.status} /></span>
                </span>
                <div role="radiogroup" aria-label={`What happens to ${t.title}`} className="inline-flex gap-0.5 rounded-lg bg-hover p-0.5">
                  {CHOICES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={choiceOf(t) === c.value}
                      onClick={() => setChoices((cur) => ({ ...cur, [String(t.apiId)]: c.value }))}
                      className={`rounded-md px-2.5 py-1 text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${choiceOf(t) === c.value ? "bg-surface font-medium text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Carried-over tasks are copied into the next sprint (or the Backlog if there is none). A task&apos;s Tickets follow it.</p>
        </section>
      ) : (
        <p className="text-sm text-muted">Every task in this sprint is Done.</p>
      )}

      {planned.length > 0 && (
        <section aria-label="Start the next sprint" className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Close this sprint and start the next planned sprint now
          </label>
          {startNow && (
            <>
              <SelectField label="Next sprint" value={nextId} onChange={setNextId} options={planned.map((s) => ({ value: s.id, label: s.name }))} required />
              <p className="text-xs text-muted">Its start date moves to today if needed. Unticked, it stays Planned.</p>
            </>
          )}
        </section>
      )}
      {error && <FieldError>{error}</FieldError>}
    </BacklogDrawer>
  );
}
