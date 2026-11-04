"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/Badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import { MY_TASK_HREF, READY_FOR_QA_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import TaskComments from "@/features/comments/TaskComments";
import { getErrorMessage } from "@/lib/apiClient";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData } from "@/types/backlog";

/** What a task card opens inside itself with its arrow: the task's Tickets (a click opens one) and its Comments. Read when opened, not before. */
export default function TaskCardMore({ task }: { task: BacklogItemData }) {
  const router = useRouter();
  const { isQa, isAdmin } = useAuth();
  const [tab, setTab] = useState<"tickets" | "comments">("tickets");
  const [tickets, setTickets] = useState<BacklogItemData[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    backlogService.getTickets(task.id).then(setTickets, (err) => setError(getErrorMessage(err)));
  }, [task.id]);
  const area = isQa || isAdmin ? READY_FOR_QA_HREF : MY_TASK_HREF;
  const tabClass = (on: boolean) => `rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${on ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"}`;
  return (
    <div className="flex flex-col gap-2 border-t border-border/70 pt-2" onClick={(e) => e.stopPropagation()}>
      <div role="tablist" aria-label="Tickets and comments" className="flex gap-1">
        <button type="button" role="tab" aria-selected={tab === "tickets"} onClick={() => setTab("tickets")} className={tabClass(tab === "tickets")}>Tickets{tickets ? ` (${tickets.length})` : ""}</button>
        <button type="button" role="tab" aria-selected={tab === "comments"} onClick={() => setTab("comments")} className={tabClass(tab === "comments")}>Comments</button>
      </div>
      {tab === "comments" ? (
        <TaskComments taskId={task.id} />
      ) : error ? (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</p>
      ) : tickets === null ? (
        <p role="status" className="text-xs text-muted">Loading…</p>
      ) : tickets.length === 0 ? (
        <p className="text-xs text-muted">No Tickets yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tickets.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => router.push(`${area}/ticket?id=${t.apiId}`)} className="flex w-full items-center justify-between gap-2 rounded-md bg-surface/70 px-2 py-1.5 text-left text-xs hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
                <span className="min-w-0 truncate"><span className="font-mono text-[11px] text-muted">{t.id}</span> {t.title}</span>
                <StatusBadge status={t.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The arrow in the last column of a list row: right while closed, down while its Tickets and comments (TaskCardMore) are showing under the row. */
export function RowArrow({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => (e.stopPropagation(), onToggle())}
      aria-expanded={open}
      aria-label={open ? "Hide Tickets and comments" : "Show Tickets and comments"}
      title={open ? "Hide Tickets and comments" : "Tickets and comments"}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-hover align-middle text-foreground transition-colors hover:bg-border focus-visible:outline-2 focus-visible:outline-accent"
    >
      <ChevronRightIcon width={12} height={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
    </button>
  );
}
