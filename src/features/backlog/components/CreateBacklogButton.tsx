"use client";

import { PlusIcon } from "@/components/ui/icons";
import { useBacklog } from "../context/BacklogContext";

export default function CreateBacklogButton() {
  const { openCreate } = useBacklog();

  return (
    <button
      type="button"
      onClick={openCreate}
      data-close-sidebar
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <PlusIcon />
      Create backlog
    </button>
  );
}
