"use client";

import { PlusIcon } from "@/components/ui/icons";
import { usePathname, useSearchParams } from "next/navigation";
import { useBacklog } from "../context/BacklogContext";
import { canPressB } from "../shortcuts";

/** `gradient` is the brand gradient (page header); the default is the single accent colour (sidebar). */
export default function CreateBacklogButton({ gradient = false }: { gradient?: boolean }) {
  const { openCreate } = useBacklog();
  const keyed = canPressB(usePathname(), useSearchParams().get("view"));

  return (
    <button
      type="button"
      onClick={openCreate}
      aria-label="Create backlog"
      aria-keyshortcuts={keyed ? "B" : undefined}
      title={keyed ? "Create backlog (press B · ? for all shortcuts)" : "Create backlog"}
      data-close-sidebar
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${gradient ? "btn-brand" : "bg-accent text-accent-foreground"}`}
    >
      <PlusIcon />
      <span className="sb-label">Create backlog {keyed && <kbd className="ml-1 hidden rounded border border-current/30 px-1.5 text-[10px] font-medium opacity-80 lg:inline">B</kbd>}</span>
    </button>
  );
}
