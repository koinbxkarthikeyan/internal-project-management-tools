"use client";

import Link from "next/link";
import { CheckCircleIcon } from "@/components/ui/icons";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useBacklog } from "../context/BacklogContext";

/**
 * A short checklist for an admin on a new, empty app: who owns the work, which sprint it is planned in, the first task, and who else is on the team. It goes away
 * by itself once every step has been done, and it never creates anything.
 */
export default function GettingStarted() {
  const { isAdmin } = useAuth();
  const { items, hiddenItems, ownerRecords, sprints } = useBacklog();
  const users = useUsers();
  const steps = [
    { done: ownerRecords.some((o) => o.id !== "unassigned"), title: "Add an owner", text: "Owners are the people or groups tasks are filed under.", href: "/owners-sprints", cta: "Owners & sprints" },
    { done: sprints.some((s) => s.name !== "Unplanned"), title: "Plan a sprint", text: "A sprint runs for two weeks; tasks are planned into it.", href: "/sprint-plan", cta: "Sprint plan" },
    { done: items.length + hiddenItems.length > 0, title: "Create the first backlog task", text: "Give it an owner, a type and a sprint.", href: "/all-items", cta: "All items" },
    { done: users.length > 1, title: "Add your team", text: "Everyone signs in with the email and password you give them.", href: "/users", cta: "Team Members" },
  ];
  if (!isAdmin || steps.every((s) => s.done)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section aria-label="Getting started" className="anim-fade-up rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Get started</h2>
        <p className="text-xs text-muted">{doneCount} of {steps.length} done</p>
      </header>
      <ol className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className={`flex flex-col gap-1.5 rounded-xl border p-3 ${s.done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-background/60"}`}>
            <p className="flex items-center gap-2 text-sm font-semibold">
              {s.done ? <CheckCircleIcon className="shrink-0 text-emerald-600 dark:text-emerald-300" width={18} height={18} aria-label="Done" /> : <span aria-hidden="true" className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-border text-[10px] text-muted">{i + 1}</span>}
              {s.title}
            </p>
            <p className="text-xs text-muted">{s.text}</p>
            {!s.done && (
              <Link href={s.href} className="mt-auto w-fit text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
                {s.cta} →
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
