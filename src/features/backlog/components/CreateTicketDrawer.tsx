"use client";

import type { BacklogItemData } from "@/types/backlog";
import BacklogDrawer from "./BacklogDrawer";
import { TicketFormFields, useTicketForm } from "./TicketForm";

/** QA adds a Ticket directly under a task. The Ticket is linked to that task's id and starts in the task's sprint. */
export default function CreateTicketDrawer({ task, onClose, onCreated }: { task: BacklogItemData; onClose: () => void; onCreated: (ticket: BacklogItemData) => void }) {
  const form = useTicketForm(task, onCreated);
  return (
    <BacklogDrawer heading="Create Ticket" submitLabel="Create Ticket" compact onSubmit={form.submit} canSubmit={form.canSubmit} onClose={onClose}>
      <TicketFormFields task={task} form={form} />
    </BacklogDrawer>
  );
}
