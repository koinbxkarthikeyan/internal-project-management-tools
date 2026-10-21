"use client";

import { PlusIcon } from "@/components/ui/icons";
import { useBacklog } from "../context/BacklogContext";

/** `gradient` is the brand gradient (page header); the default is the single accent colour (sidebar). */
export default function CreateBacklogButton({ gradient = false }: { gradient?: boolean }) {
  const { openCreate } = useBacklog();

  return (
    <button
      type="button"
      onClick={openCreate}
      data-close-sidebar
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${gradient ? "btn-brand" : "bg-accent text-accent-foreground"}`}
    >
      <PlusIcon />
      Create backlog
    </button>
  );
}
