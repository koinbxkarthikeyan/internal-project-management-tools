"use client";

import type { ReactNode } from "react";
import { useBacklog } from "../context/BacklogContext";
import RailTip from "@/components/ui/RailTip";
import SignOutBlock from "@/features/auth/components/SignOutBlock";
import { useAuth } from "@/features/auth/hooks/useAuth";
import MessagesLink from "@/features/messages/components/MessagesLink";
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
    const mine = items.filter((i) => i.status !== "Done" && (i.sprint === "Unplanned" || (!!activeSprint && i.sprint === activeSprint.name)));
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

  // Only the menu scrolls; the account card (with Theme, Settings and Sign Out in its menu) stays fixed at the bottom of the sidebar.
  const shell = (menu: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sb-pad sb-menu-area flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4 pt-4">{menu}</div>
      <div className="sb-pad shrink-0 px-4 pb-4">
        <SignOutBlock />
      </div>
    </div>
  );

  // A Disabled normal User: only Settings and Sign out (the fixed bottom block).
  if (settingsOnly) return shell(null);

  // A normal User: the sidebar offers only "What are you working on? > My sprint / My Task" (and Settings below).
  if (restricted) return shell(<><MessagesLink /><WorkSidebarSection /></>);

  return shell(
    <>
      <header className="sb-card card-inset p-3">
        <h2 className="sb-label text-base font-semibold">Backlog tracker</h2>
        <p className="sb-label mt-1 text-xs leading-relaxed text-muted">{summary}</p>
        <RailTip label="Create backlog" className="mt-3 sb-create">
          <CreateBacklogButton />
        </RailTip>
      </header>
      <MessagesLink />
      <BacklogNavigation between={<WorkSidebarSection />} />
    </>,
  );
}
