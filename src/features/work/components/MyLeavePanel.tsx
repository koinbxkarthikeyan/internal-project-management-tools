"use client";

import { useState } from "react";
import LeaveEditor, { LeaveTag } from "@/components/ui/LeaveEditor";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLeaveStore } from "@/stores/leaveStore";
import type { Sprint } from "@/types/backlog";

type Dated = Sprint & { start: string; end: string };

/**
 * On My Sprint: the sprint's common leave (read-only; it is part of the sprint) and the signed-in person's own leave dates, saved to and read from the backend.
 * Their own leave affects only their expected hours. A saved day can't be changed on the backend: remove it and add it again. Closed sprints are read-only history.
 */
export default function MyLeavePanel({ sprints }: { sprints: readonly Dated[] }) {
  const { user } = useAuth();
  const toast = useToast();
  const personal = useLeaveStore((s) => s.personal);
  const [open, setOpen] = useState(false);
  if (!user || sprints.length === 0) return null;
  const ids = new Set(sprints.map((s) => s.id));
  const mine = personal.filter((p) => ids.has(p.sprintId) && p.userId === user.id);
  const shared = sprints.flatMap((s) => (s.commonLeaves ?? []).map((l) => ({ id: `${s.id}:${l.date}`, date: l.date, name: l.description })));
  const store = useLeaveStore.getState;
  const editable = sprints.filter((s) => s.status !== "Closed");
  const min = sprints.reduce((m, s) => (s.start < m ? s.start : m), sprints[0].start);
  const max = sprints.reduce((m, s) => (s.end > m ? s.end : m), sprints[0].end);
  const WRONG = sprints.length === 1 ? "Pick a day inside this sprint." : "Pick a day inside a chosen sprint.";

  return (
    <section aria-label="Leave dates" className="rounded-2xl border border-border bg-surface px-5 py-3 sm:px-6">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md py-1 text-left text-sm focus-visible:outline-2 focus-visible:outline-accent">
        <span className="font-semibold">Leave dates</span>
        <LeaveTag kind="common" />
        <span className="text-xs text-muted">{shared.length}</span>
        <LeaveTag kind="personal" />
        <span className="text-xs text-muted">{mine.length}</span>
        <span className="ml-auto text-xs font-medium text-accent">{open ? "Hide" : "Add My Leave / manage"}</span>
      </button>
      {open && (
        <div className="grid gap-4 pb-2 pt-2 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-muted">Common leave (0 hours for everyone)</h3>
            <LeaveEditor kind="common" named canEdit={false} addLabel="" empty="No common leave in this sprint." rows={shared} onAdd={() => undefined} onRemove={() => {}} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-muted">My leave (0 hours for me only)</h3>
            <LeaveEditor
              kind="personal"
              canEdit={editable.length > 0}
              min={min}
              max={max}
              addLabel="Add My Leave"
              empty="You haven't added any leave dates."
              rows={mine}
              onAdd={async (date, _name, hours) => {
                const sp = editable.find((s) => date >= s.start && date <= s.end);
                if (!sp) return WRONG;
                const err = await store().add(sp.id, user.id, [{ date, hours }]);
                if (!err) toast.show("Leave date added");
                return err;
              }}
              onRemove={async (id) => {
                const cur = mine.find((p) => p.id === id);
                const err = cur ? await store().remove(id, cur.sprintId, user.id) : undefined;
                toast.show(err ?? "Leave date removed", err ? "danger" : "delete");
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
