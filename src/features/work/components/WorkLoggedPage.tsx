"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { WORK_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import ConfirmDeleteDrawer from "@/features/backlog/components/ConfirmDeleteDrawer";
import type { WorkEntry } from "@/types/work";
import { useChosenSprints } from "../hooks/useChosenSprints";
import { useWorkData } from "../hooks/useWorkData";
import { todayISO } from "@/features/backlog/utils";
import { myHoursBySprint, sprintHours } from "../utils";
import HoursSummaryLine from "./HoursSummaryLine";
import SprintPicker from "./SprintPicker";
import WorkEntriesList from "./WorkEntriesList";
import WorkEntryDetailsDrawer from "./WorkEntryDetailsDrawer";

const card = "rounded-2xl border border-border bg-surface p-5";
const backLink =
  "inline-flex h-10 items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent";

/** Your Logged Work: every entry you logged in the chosen sprint, with change and remove. Changing an entry opens it on Log Work, where the form is. */
export default function WorkLoggedPage() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const work = useWorkData();
  const { datedSprints, chosen, setPicked } = useChosenSprints();
  const [removing, setRemoving] = useState<WorkEntry | null>(null);
  const [viewing, setViewing] = useState<WorkEntry | null>(null);
  const person = user?.name ?? "";

  if (work.status === "loading") return <PageSkeleton />;
  if (work.status === "error") {
    return (
      <section role="alert" className={`${card} flex min-h-64 flex-col items-center justify-center text-center`}>
        <h2 className="text-base font-semibold">Couldn&apos;t load your logged work</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">{work.error}</p>
        <button type="button" onClick={work.reload} className="mt-4 rounded-xl btn-brand px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Try again
        </button>
      </section>
    );
  }

  const header = <PageHeader title="Your Logged Work" description="Everything you logged in the chosen sprint." actions={<Link href={WORK_HREF} className={backLink}>Back to Log Work Sprint</Link>} />;
  if (datedSprints.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <section className={card}>
          <EmptyState title="No sprint added yet" description="Create a sprint to get started." />
        </section>
      </div>
    );
  }

  const chosenSet = new Set(chosen.map((s) => s.id));
  // Only this person's entries, in the chosen sprint.
  const mine = work.entries
    .filter((e) => chosenSet.has(e.sprintId) && e.person === person)
    .sort((a, b) => a.from.localeCompare(b.from) || a.createdAt.localeCompare(b.createdAt));

  // The same line as on Log Sprint Work: this person's entries in the chosen sprint against that sprint's weekday hours.
  const { soFar, total } = sprintHours(chosen, todayISO());
  const loggedHours = mine.reduce((sum, e) => sum + e.hours, 0);

  async function remove(entry: WorkEntry) {
    if (!(await work.removeEntry(entry.id))) return false;
    toast.show("Removed from your sprint", "delete");
  }

  return (
    <div className="flex flex-col gap-5">
      {header}
      <SprintPicker sprints={datedSprints} selectedIds={chosen.map((s) => s.id)} onChange={setPicked} />
      <section className={card}>
        <WorkEntriesList
          title="Your Logged Work"
          entries={mine}
          hoursLine={<HoursSummaryLine logged={loggedHours} soFar={soFar} total={total} />}
          sprintTotals={myHoursBySprint(work.entries, datedSprints, { id: user?.id, name: person })}
          showPerson={false}
          onChange={(entry) => router.push(`${WORK_HREF}?edit=${encodeURIComponent(entry.id)}`)}
          onView={setViewing}
          onRemove={setRemoving}
        />
      </section>
      {viewing && <WorkEntryDetailsDrawer key={viewing.id} entry={viewing} hoursLine={<HoursSummaryLine logged={loggedHours} soFar={soFar} total={total} className="text-sm text-muted" />} onClose={() => setViewing(null)} />}
      {removing && (
        <ConfirmDeleteDrawer
          key={removing.id}
          title="Remove from sprint"
          name={removing.task}
          consequence={`${removing.hours}h logged by ${removing.person} will be removed from the sprint.`}
          onClose={() => setRemoving(null)}
          onConfirm={() => remove(removing)}
        />
      )}
    </div>
  );
}
