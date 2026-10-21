"use client";

import type { ReactNode } from "react";
import { todayISO } from "../utils";
import { useBacklog } from "../context/BacklogContext";
import SignOutBlock from "@/features/auth/components/SignOutBlock";
import { useAuth } from "@/features/auth/hooks/useAuth";
import WorkSidebarSection from "@/features/work/components/WorkSidebarSection";
import BacklogNavigation from "./BacklogNavigation";
import CreateBacklogButton from "./CreateBacklogButton";

export default function BacklogSidebar() {
  const { status, items, sprints } = useBacklog();
  const { restricted, settingsOnly } = useAuth();

  let summary = "Loading…";
  if (status === "ready") {
    const count = (fn: (s: string) => boolean) => items.filter((i) => fn(i.status)).length;
    const today = todayISO();
    const active = sprints.find((s) => s.start && s.end && s.start <= today && today <= s.end);
    summary = [
      `${count((s) => s === "Open" || s === "In progress")} open`,
      `${count((s) => s === "Blocked")} blocked`,
      `${count((s) => s === "On hold")} on hold`,
      active ? `${active.name} active` : "No active sprint",
    ].join(" · ");
  } else if (status === "error") {
    summary = "Couldn't load data";
  }

  // Only the menu scrolls; who is signed in, Settings and Sign out stay fixed at the bottom of the sidebar.
  const shell = (menu: ReactNode) => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sb-scroll flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-5 pt-5">{menu}</div>
      <div className="sb-foot shrink-0 px-4 pb-5">
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
      <header className="sb-card rounded-xl border border-border bg-background/60 p-4">
        <h2 className="text-base font-semibold">Backlog tracker</h2>
        <p className="sb-note mt-1 text-xs leading-relaxed text-muted">{summary}</p>
        <div className="mt-3">
          <CreateBacklogButton />
        </div>
      </header>
      <BacklogNavigation between={<WorkSidebarSection />} />
    </>,
  );
}
