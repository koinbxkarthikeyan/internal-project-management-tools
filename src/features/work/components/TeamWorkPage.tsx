"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import { WORK_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useChosenSprints } from "../hooks/useChosenSprints";
import { useWorkData } from "../hooks/useWorkData";
import SprintPicker from "./SprintPicker";
import TeamWorkView from "./TeamWorkView";

const card = "rounded-2xl border border-border bg-surface p-5";

/** Team Work Details: every person's PODs, tasks and logged hours in the chosen sprints. Only for a Super Admin and an enabled Admin. */
export default function TeamWorkPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const work = useWorkData();
  const { datedSprints, chosen, setPicked } = useChosenSprints();

  // Anyone else has their own work on Your Logged Work instead.
  useEffect(() => {
    if (!isAdmin) router.replace(WORK_HREF);
  }, [isAdmin, router]);
  if (!isAdmin) return null;

  if (work.status === "loading") return <PageSkeleton />;
  if (work.status === "error") {
    return (
      <section role="alert" className={`${card} flex min-h-64 flex-col items-center justify-center text-center`}>
        <h2 className="text-base font-semibold">Couldn&apos;t load the team&apos;s work</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">{work.error}</p>
        <button type="button" onClick={work.reload} className="mt-4 rounded-xl btn-brand px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Try again
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Team Work Details" description="Everyone's PODs, tasks and logged hours in the chosen sprint." />
      {datedSprints.length === 0 ? (
        <section className={card}>
          <EmptyState title="No sprint added yet" description="Create a sprint to get started." />
        </section>
      ) : (
        <>
          <SprintPicker sprints={datedSprints} selectedIds={chosen.map((s) => s.id)} onChange={setPicked} />
          <TeamWorkView work={work} chosen={chosen} />
        </>
      )}
    </div>
  );
}
