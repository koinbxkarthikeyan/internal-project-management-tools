"use client";

import type { ReactNode } from "react";
import { useBacklog } from "../context/BacklogContext";
import SignOutBlock from "@/features/auth/components/SignOutBlock";
import { useAuth } from "@/features/auth/hooks/useAuth";
import WorkSidebarSection from "@/features/work/components/WorkSidebarSection";
import BacklogNavigation from "./BacklogNavigation";
import CreateBacklogButton from "./CreateBacklogButton";

export default function BacklogSidebar() {
  const { status, items, activeSprint, itemsPaging } = useBacklog();
  const { restricted, settingsOnly } = useAuth();

  let summary = "Loading…";
  if (status === "ready" && !itemsPaging.complete) {
    // Only the first pages of the All Items table are loaded, so counts by status would be wrong: name the running sprint only.
    summary = activeSprint ? `${activeSprint.name} active` : "No active sprint";
  } else if (status === "ready") {
    // Only the running sprint's tasks and the Backlog tasks that are still active: nothing from planned, paused, closed or earlier sprints, and no finished tasks.
    const mine = items.filter((i) => i.status !== "Completed" && (i.sprint === "Unplanned" || (!!activeSprint && i.sprint === activeSprint.name)));
    const count = (fn: (s: string) => boolean) => mine.filter((i) => fn(i.status)).length;
    summary = [
      `${count((s) => s === "Open" || s === "In progress")} open`,
      `${count((s) => s === "Blocked")} blocked`,
      `${count((s) => s === "On hold")} on hold`,
      activeSprint ? `${activeSprint.name} active` : "No active sprint",
    ].join(" · ");
  } else if (status === "error") {
    summary = "Couldn't load data";
  }

  // Only the menu scrolls; who is signed in, Settings and Sign out stay fixed at the bottom of the sidebar.
  const shell = (menu: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-4">{menu}</div>
      <div className="shrink-0 px-4 pb-4">
        <SignOutBlock />
      </div>
    </div>
  );

  // A Disabled normal User: only Settings and Sign out (the fixed bottom block).
  if (settingsOnly) return shell(null);

  // A normal User: the sidebar offers only "What are you working on? > My sprint / My Task" (and Settings below).
  if (restricted) return shell(<WorkSidebarSection />);

  return shell(
    <>
      <header className="rounded-xl border border-border bg-background/60 p-3">
        <h2 className="text-base font-semibold">Backlog tracker</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">{summary}</p>
        <div className="mt-3">
          <CreateBacklogButton />
        </div>
      </header>
      <BacklogNavigation between={<WorkSidebarSection />} />
    </>,
  );
}
