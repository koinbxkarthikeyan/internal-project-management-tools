"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { MY_TASK_HREF, READY_FOR_QA_HREF } from "@/constants/work";
import { getErrorMessage } from "@/lib/apiClient";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData, Status } from "@/types/backlog";
import BackLink from "./BackLink";
import TicketView from "./TicketView";

const STATUSES: readonly string[] = ["Open", "In progress", "Ready for QA", "Testing", "Blocked", "On hold", "Done"];

/** A Ticket as its own full page (no window over the task). Back returns to its task, with the Ticket still marked there. `status` (from a card dropped on a board column) waits for its comment. */
export default function QaTicketPage() {
  const mine = usePathname().startsWith(MY_TASK_HREF);
  const area = mine ? MY_TASK_HREF : READY_FOR_QA_HREF;
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const wanted = params.get("status");
  const [loaded, setLoaded] = useState<{ ticket: BacklogItemData; task: BacklogItemData } | null>(null);
  const [error, setError] = useState("");
  const invalid = !Number.isInteger(id) || id <= 0;

  useEffect(() => {
    if (invalid) return;
    let cancelled = false;
    (async () => {
      const ticket = await backlogService.getItemByApiId(id);
      const parent = Number(ticket.parent?.split("-")[1]);
      if (!Number.isInteger(parent) || parent <= 0) throw new Error("That Ticket's task isn't available.");
      const task = await backlogService.getItemByApiId(parent);
      if (!cancelled) setLoaded({ ticket, task });
    })().catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [id, invalid]);

  if (error || invalid) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href={area} label={mine ? "Back to My Task" : "Back to QA Workspace"} />
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error || "That Ticket isn't available."}</p>
      </div>
    );
  }
  if (!loaded) return <PageSkeleton />;
  const { ticket, task } = loaded;
  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`${area}/task?id=${task.apiId}&ticket=${encodeURIComponent(ticket.id)}`} label={`Back to ${task.id} ${task.title}`} />
      <TicketView key={ticket.id} ticket={ticket} task={task} initialStatus={wanted && STATUSES.includes(wanted) ? (wanted as Status) : undefined} />
    </div>
  );
}
