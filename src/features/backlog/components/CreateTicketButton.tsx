"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { PlusIcon } from "@/components/ui/icons";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { BacklogItemData } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import { refreshTicketViews } from "../ticketRefresh";
import CreateTicketDrawer from "./CreateTicketDrawer";

/**
 * The Create Ticket button on a task's card or list row: it opens the Create Ticket form for that task. Offered to everybody once the task is with QA (Ready for QA or Testing),
 * as on the task's page. A click on it (or in the form) never opens the card.
 */
export default function CreateTicketButton({ task }: { task: BacklogItemData }) {
  const { user } = useAuth();
  const { refreshItems } = useBacklog();
  const [creating, setCreating] = useState(false);
  const canCreate = task.status === "Ready for QA" || task.status === "Testing";
  if (!canCreate) return null;
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="inline-flex">
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-border px-2.5 text-[11px] font-semibold text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
      >
        <PlusIcon width={12} height={12} /> Create Ticket
      </button>
      {creating && typeof document !== "undefined" && createPortal(
        <CreateTicketDrawer
          task={task}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            // A QA member's first Ticket moves the task to Testing and adds them to it: the lists and pages read the task again.
            refreshItems();
            if (user) refreshTicketViews(user.id);
          }}
        />,
        document.body,
      )}
    </span>
  );
}
