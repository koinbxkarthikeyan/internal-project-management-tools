"use client";

import type { ReactNode } from "react";
import BacklogDrawer from "@/features/backlog/components/BacklogDrawer";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { formatActivityTime, formatDeadline } from "@/features/backlog/utils";
import type { WorkEntry } from "@/types/work";
import { formatDay, formatHours } from "../utils";

const rowClass = "grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={rowClass}>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

/** Everything stored about one logged work entry (read only): its sprint, tasks with their descriptions, who, when, hours and notes. */
export default function WorkEntryDetailsDrawer({ entry, hoursLine, onClose }: { entry: WorkEntry; /** The sprint hours line for this person and sprint. */ hoursLine?: ReactNode; onClose: () => void }) {
  const { sprints, items, hiddenItems } = useBacklog();
  const sprint = sprints.find((s) => s.id === entry.sprintId);
  const tasks = (entry.itemIds ?? []).flatMap((id) => [...items, ...hiddenItems].filter((i) => i.id === id).slice(0, 1));
  const same = entry.from === entry.to;

  return (
    <BacklogDrawer heading="Work entry details" submitLabel="" viewOnly onSubmit={() => undefined} onClose={onClose}>
      <dl className="flex flex-col gap-4">
        <Row label="Sprint">
          {sprint ? (
            <>
              <span className="font-semibold text-accent">{sprint.name}</span>
              {sprint.start && sprint.end && <span className="block text-xs text-muted">{formatDeadline(sprint.start)} – {formatDeadline(sprint.end)}</span>}
            </>
          ) : (
            "—"
          )}
        </Row>
        <Row label={entry.otherWork ? "Work" : tasks.length > 1 ? "Tasks" : "Task"}>
          {entry.otherWork || tasks.length === 0 ? (
            <span className="font-semibold text-foreground">{entry.task || "—"}</span>
          ) : (
            <ul className="flex flex-col gap-3">
              {tasks.map((t) => (
                <li key={t.id}>
                  <span className="font-semibold text-foreground">{t.title}</span> <span className="text-xs text-muted">{t.id}</span>
                  <p className="mt-0.5 whitespace-pre-line text-xs text-muted">{t.description || "No description."}</p>
                </li>
              ))}
            </ul>
          )}
        </Row>
        <Row label="Logged by">{entry.person || "—"}</Row>
        <Row label="Work date">{same ? formatDay(entry.from) : `${formatDay(entry.from)} → ${formatDay(entry.to)}`}</Row>
        <Row label="Hours"><span className="font-semibold text-foreground">{formatHours(entry.hours)}</span></Row>
        {hoursLine && <Row label="Sprint hours">{hoursLine}</Row>}
        <Row label="Kind of work">{entry.kind}</Row>
        <Row label="POD">{entry.pod || "—"}</Row>
        <Row label="Notes">{entry.notes ? <span className="whitespace-pre-line">{entry.notes}</span> : <span className="text-muted">No notes.</span>}</Row>
        {entry.createdAt && <Row label="Created">{formatActivityTime({ date: entry.createdAt.slice(0, 10), at: entry.createdAt })}</Row>}
      </dl>
    </BacklogDrawer>
  );
}
