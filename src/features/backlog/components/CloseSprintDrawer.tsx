"use client";

import { useState } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { SelectField } from "@/components/ui/FormControls";
import type { Sprint } from "@/types/backlog";
import BacklogDrawer from "./BacklogDrawer";

type CloseSprintDrawerProps = {
  sprint: Sprint;
  /** The planned sprints that could be started right after this one closes. */
  planned: readonly Sprint[];
  /** Runs the close, and starts `startNext` straight after when one was chosen. Return `false` to keep the panel open (e.g. the request failed). */
  onConfirm: (startNext?: Sprint) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
};

/** Side panel to confirm closing (completing) the running sprint. */
export default function CloseSprintDrawer({ sprint, planned, onConfirm, onClose }: CloseSprintDrawerProps) {
  const [error, setError] = useState("");
  const [startNow, setStartNow] = useState(false);
  const [nextId, setNextId] = useState(planned[0]?.id ?? "");

  // Unfinished tasks are not listed or changed here: the server's close copies them into the next sprint (nothing is marked Completed). A failed close leaves everything as it was.
  async function confirm() {
    setError("");
    const ok = await onConfirm(startNow ? planned.find((s) => s.id === nextId) : undefined);
    if (ok === false) setError("The sprint was not closed. Nothing was changed.");
    return ok;
  }

  return (
    <BacklogDrawer heading="Close sprint" submitLabel="Confirm Close Sprint" onSubmit={confirm} onClose={onClose} compact>
      <div role="alertdialog" aria-label="Close sprint" className="flex flex-col gap-2">
        <p className="text-sm">
          Are you sure you want to close <strong className="font-semibold">{sprint.name}</strong>?
        </p>
        <p className="text-sm text-muted">
          The sprint ends today and can&apos;t be reopened. Its tasks and logged hours stay as history. Unfinished tasks are copied to the next sprint.
        </p>
      </div>

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
