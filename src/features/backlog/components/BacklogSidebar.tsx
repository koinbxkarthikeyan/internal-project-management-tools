"use client";

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

  // A Disabled normal User: only Settings and Sign out (both live in the sign-out block).
  if (settingsOnly) {
    return (
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-5 pt-4">
        <SignOutBlock />
      </div>
    );
  }

  // A normal User: the sidebar offers only "What are you working on? > My sprint / My Task" (and Settings below).
  if (restricted) {
    return (
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-5 pt-4">
        <WorkSidebarSection />
        <SignOutBlock />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-5 pt-4">
      <header className="rounded-xl border border-border bg-background/60 p-4">
        <h2 className="text-base font-semibold">Backlog tracker</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">{summary}</p>
        <div className="mt-3">
          <CreateBacklogButton />
        </div>
      </header>
      <BacklogNavigation between={<WorkSidebarSection />} />
      <SignOutBlock />
    </div>
  );
}
