"use client";

import { useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { todayISO } from "@/features/backlog/utils";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useMyTasksStore } from "@/stores/myTasksStore";
import type { Sprint } from "@/types/backlog";
import type { WorkData } from "../hooks/useWorkData";
import { sprintHours } from "../utils";
import EveryoneView from "./EveryoneView";

/**
 * The pod / work breakdown of the chosen sprints. A Super Admin and an enabled Admin see everyone's; anyone else sees their own
 * work only. Used by the Team Work page and, for those other roles, on Your Logged Work.
 */
export default function TeamWorkView({ work, chosen, mineOnly = false }: { work: WorkData; chosen: (Sprint & { start: string; end: string })[]; /** Show only the signed-in person's own work, whatever their role (Your Logged Work). */ mineOnly?: boolean }) {
  const { sprints, pods, allPods, items, hiddenItems } = useBacklog();
  const users = useUsers();
  const { user, isAdmin, restricted } = useAuth();
  const person = user?.name ?? "";
  const everyone = isAdmin && !mineOnly;

  // The tasks the backend lists as mine (assigned to me or led by me), so a task of mine shows even before any hours are logged.
  const mineStore = useMyTasksStore();
  const mineScope = user?.id ?? "";
  const { load: loadMine } = mineStore;
  useEffect(() => {
    if (mineScope) void loadMine(mineScope);
  }, [mineScope, loadMine]);
  const ownTaskIds = new Set(mineStore.scope === mineScope ? [...mineStore.buckets.lead, ...mineStore.buckets.assigned].map((t) => t.id) : []);

  const chosenSet = new Set(chosen.map((s) => s.id));
  const { soFar: perPerson, total: sprintLimit } = sprintHours(chosen, todayISO());
  const poolPods = pods.filter((p) => chosen.some((s) => s.podIds?.includes(p.id) && items.some((i) => i.sprint === s.name && i.podId === p.id)));

  return (
    <>
      {everyone && work.teamUnavailable && (
        // Super Admin and enabled Admins are meant to see everyone's work. If the server did not provide the team view, say so instead of quietly showing only their own entries.
        <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <span>Everyone&apos;s logged work couldn&apos;t be loaded: the server did not provide the team view for this sprint. Only your own entries are shown.</span>
          <button type="button" onClick={() => work.refresh()} className="font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-accent">
            Try again
          </button>
        </p>
      )}
      <EveryoneView
        sprints={chosen}
        entries={work.entries.filter((e) => chosenSet.has(e.sprintId))}
        // Only Super Admin and an enabled Admin see people who have logged nothing; everyone else sees just those with work logged.
        people={everyone ? [...new Set(users.map((u) => u.name))] : []}
        pods={poolPods}
        tasks={items.filter((i) => chosenSet.has(chosen.find((s) => s.name === i.sprint)?.id ?? ""))}
        allTasks={[...items, ...hiddenItems]}
        allEntries={work.entries}
        allSprints={sprints}
        // Only a Super Admin or an enabled Admin sees every person and task; everyone else sees their own.
        ownOnly={everyone ? undefined : person}
        ownTaskIds={ownTaskIds}
        podNames={Object.fromEntries(allPods.map((p) => [p.id, p.name]))}
        // A User (or a Disabled Admin) sees role labels for nobody but themselves.
        details={Object.fromEntries(users.filter((u) => !(restricted || mineOnly) || u.name === person).map((u) => [u.name, u.role]))}
        perPerson={perPerson}
        sprintTotal={sprintLimit}
        updatedAt={work.updatedAt}
        onRefresh={work.refresh}
      />
    </>
  );
}
