"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useQueryState } from "@/hooks/useQueryState";
import { useToast } from "@/components/ui/Toast";
import { FOCUS_HOURS_PER_DAY, SPRINT_TASKS_POD, UNPLANNED_POD, isPseudoPod } from "@/constants/work";
import ConfirmDeleteDrawer from "@/features/backlog/components/ConfirmDeleteDrawer";
import { SelectField } from "@/components/ui/FormControls";
import { USER_TEAMS } from "@/constants/auth";
import { refreshUsers } from "@/lib/auth/userStore";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { todayISO } from "@/features/backlog/utils";
import type { BacklogItemData } from "@/types/backlog";
import type { Pod, WorkEntry, WorkEntryInput } from "@/types/work";
import { useWorkData } from "../hooks/useWorkData";
import { formatDay, plannedHours, workingDays } from "../utils";
import EveryoneView from "./EveryoneView";
import ScopeTabs, { type WorkScope } from "./ScopeTabs";
import SprintGlance from "./SprintGlance";
import SprintPicker from "./SprintPicker";
import SprintPodTasks, { type TaskSelection } from "./SprintPodTasks";
import SprintSummary from "./SprintSummary";
import WorkEntriesList from "./WorkEntriesList";
import WorkForm from "./WorkForm";

const card = "rounded-2xl border border-border bg-surface p-5";

/** The "What are you working on?" section: independent of the Backlog pages (it only reads sprints, PODs, tasks and owners). */
export default function WorkPage() {
  const toast = useToast();
  const { sprints, pods, allPods, items, hiddenItems } = useBacklog();
  const users = useUsers();
  const work = useWorkData();

  const datedSprints = useMemo(
    () => sprints.flatMap((s) => (s.start && s.end ? [{ ...s, start: s.start, end: s.end }] : [])),
    [sprints],
  );
  const today = todayISO();

  // Which sprints are ticked; until the user chooses, the sprint running today (else the latest) is used.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [scope, setScope] = useQueryState<WorkScope>("tab", ["mine", "everyone"], "mine");
  // Entries are logged as the signed-in registered user, read from the Users data.
  const { user } = useAuth();
  const person = user?.name ?? "";
  // Re-read the users when the page opens, so a Team an Admin changed shows up here.
  useEffect(() => {
    void refreshUsers();
  }, []);
  const myTeam = users.find((u) => u.id === user?.id)?.team ?? user?.team ?? "";
  // Hours currently in the form, so the bar follows what is being entered.
  const [draftHours, setDraftHours] = useState<number | null>(null);
  const [selection, setSelection] = useState<TaskSelection | null>(null);
  const [editing, setEditing] = useState<WorkEntry | null>(null);
  const [removing, setRemoving] = useState<WorkEntry | null>(null);
  // Bumped after each save so the form remounts with fresh defaults.
  const [formKey, setFormKey] = useState(0);

  if (work.status === "loading") return <PageSkeleton />;

  if (work.status === "error") {
    return (
      <section role="alert" className={`${card} flex min-h-64 flex-col items-center justify-center text-center`}>
        <h2 className="text-base font-semibold">Couldn&apos;t load your sprint</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">{work.error}</p>
        <button
          type="button"
          onClick={work.reload}
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try again
        </button>
      </section>
    );
  }

  if (datedSprints.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="What are you working on?" />
        <section className={card}>
          <EmptyState
            title="No sprint to plan against yet"
            description="Start a sprint (it lasts two weeks), choose its PODs, then come back to log your work."
            action={
              <Link
                href="/sprint-plan"
                className="inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Go to Sprint plan
              </Link>
            }
          />
        </section>
      </div>
    );
  }

  // Default to the running sprint; if none is running, the most recent one.
  const fallback =
    datedSprints.find((s) => s.status === "Active") ??
    datedSprints.find((s) => s.start <= today && today <= s.end) ??
    datedSprints[datedSprints.length - 1];
  const chosenIds = (picked ?? [fallback.id]).filter((id) => datedSprints.some((s) => s.id === id));
  const chosen = datedSprints
    .filter((s) => (chosenIds.length ? chosenIds : [fallback.id]).includes(s.id))
    .sort((a, b) => a.start.localeCompare(b.start));
  const chosenSet = new Set(chosen.map((s) => s.id));

  const inSprints = work.entries.filter((e) => chosenSet.has(e.sprintId));
  const everyone = scope === "everyone";
  const scoped = inSprints
    .filter((e) => e.person === person)
    .sort((a, b) => a.from.localeCompare(b.from) || a.createdAt.localeCompare(b.createdAt));

  // Expected hours count working days up to today only (weekends excluded); days still to come are not included.
  // A finished sprint counts in full. Hours already logged are never touched by this.
  const perPerson = chosen.reduce(
    (sum, s) => sum + (today < s.start ? 0 : workingDays(s.start, today > s.end ? s.end : today) * FOCUS_HOURS_PER_DAY),
    0,
  );
  const expected = perPerson;
  // What the whole sprint plans for one person: worked hours beyond this show as the red part of the bar.
  const sprintLimit = chosen.reduce((sum, s) => sum + plannedHours(s.start, s.end), 0);
  const savedHours = scoped.reduce((sum, e) => sum + e.hours, 0);

  // The form logs against the sprint of the ticked tasks, or the first chosen sprint until something is ticked.
  const formSprint = chosen.find((s) => s.id === selection?.sprintId) ?? chosen[0];
  // Once the dates or hours in the form are changed, they count too (an entry being changed is replaced by them).
  const logged = draftHours !== null && person && formSprint.status !== "Closed" ? savedHours - (editing?.hours ?? 0) + draftHours : savedHours;
  const selectedTasks = selection
    ? selection.itemIds.flatMap((id) => items.filter((i) => i.id === id))
    : [];
  // The entry is filed under the POD of the ticked tasks plus "Sprint tasks" / "Unplanned" for tasks without a POD.
  const realPod = selection && !isPseudoPod(selection.podId) ? (pods.find((p) => p.id === selection.podId) ?? null) : null;
  const podLabel = [
    realPod?.name,
    selectedTasks.some((t) => t.sprint !== "Unplanned" && !t.podId) ? SPRINT_TASKS_POD.name : null,
    selectedTasks.some((t) => t.sprint === "Unplanned") ? UNPLANNED_POD.name : null,
  ]
    .filter(Boolean)
    .join(" + ");
  const selectedPod: Pod | null = selection ? { id: selection.podId, name: podLabel } : null;
  const mixedPod = selectedPod;

  // Only PODs that have tasks in a chosen sprint count here.
  // A task with assignees is shown only to them and to its Lead; a task with none is shown to everyone.
  const names = (value?: string) => (value ?? "").split(",").map((n) => n.trim().replace(/^@+/, "").trim().toLowerCase()).filter(Boolean);
  const myTasks = items.filter((t) => {
    const assigned = names(t.assignees);
    return assigned.length === 0 || assigned.includes(person.toLowerCase()) || (!!t.lead && t.lead.toLowerCase() === person.toLowerCase());
  });

  // Tasks this person already logged, by sprint (the entry being changed doesn't count, so its tasks stay pickable).
  const loggedBySprint: Record<string, Set<string>> = {};
  for (const e of scoped) {
    if (e.id === editing?.id) continue;
    const set = (loggedBySprint[e.sprintId] ??= new Set());
    for (const id of e.itemIds ?? []) set.add(id);
  }

  const poolPods = pods.filter((p) => chosen.some((s) => s.podIds?.includes(p.id) && items.some((i) => i.sprint === s.name && i.podId === p.id)));
  const sprintNames = chosen.map((s) => s.name).join(", ");

  function setSprints(ids: string[]) {
    setPicked(ids);
    // Ticked tasks from a sprint that was just unticked no longer apply.
    if (selection && !ids.includes(selection.sprintId)) setSelection(null);
    setEditing(null);
    setFormKey((k) => k + 1);
  }

  function toggleTask(sprint: { id: string }, pod: Pod, item: BacklogItemData) {
    const noPodTask = (id: string) => !items.find((i) => i.id === id)?.podId;
    setSelection((prev) => {
      if (!prev || prev.sprintId !== sprint.id) {
        return { sprintId: sprint.id, podId: !item.podId ? UNPLANNED_POD.id : pod.id, itemIds: [item.id] };
      }
      if (prev.itemIds.includes(item.id)) {
        const itemIds = prev.itemIds.filter((i) => i !== item.id);
        if (!itemIds.length) return null;
        return { ...prev, podId: itemIds.every(noPodTask) ? UNPLANNED_POD.id : prev.podId, itemIds };
      }
      // Tasks without a POD (Sprint tasks, Unplanned) can be ticked together with the tasks of one POD.
      if (!item.podId) return { ...prev, itemIds: [...prev.itemIds, item.id] };
      // Ticking a task in a different POD starts a new POD selection (one entry covers one POD), keeping the Unplanned ticks.
      const kept = prev.podId === pod.id ? prev.itemIds : prev.itemIds.filter(noPodTask);
      return { ...prev, podId: pod.id, itemIds: [...kept, item.id] };
    });
  }

  async function submit(input: WorkEntryInput) {
    const ok = editing ? await work.updateEntry(editing.id, input) : await work.addEntry(input);
    if (ok) {
      toast.show(editing ? "Changes saved" : "Added to your sprint");
      setEditing(null);
      setSelection(null);
      setFormKey((k) => k + 1);
    }
    return ok;
  }

  async function remove(entry: WorkEntry) {
    if (!(await work.removeEntry(entry.id))) return false;
    toast.show("Removed from your sprint", "danger");
    if (editing?.id === entry.id) {
      setEditing(null);
      setSelection(null);
      setFormKey((k) => k + 1);
    }
  }

  function startEditing(entry: WorkEntry) {
    setEditing(entry);
    // Re-tick the tasks of this entry (the ones that still exist), and make sure its sprint is shown.
    const itemIds = (entry.itemIds ?? []).filter((id) => items.some((i) => i.id === id));
    const podId = entry.podId ?? (itemIds.length ? UNPLANNED_POD.id : undefined);
    setSelection(podId && itemIds.length ? { sprintId: entry.sprintId, podId, itemIds } : null);
    if (!chosenSet.has(entry.sprintId)) setPicked([...chosen.map((s) => s.id), entry.sprintId]);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const rangeText =
    chosen.length === 1
      ? `${chosen[0].name} sprint · ${formatDay(chosen[0].start)} to ${formatDay(chosen[0].end)}`
      : `${chosen.length} sprints · ${sprintNames}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="What are you working on?"
        description={`${rangeText}. Pick what you're on, the dates you're on it, and roughly how many hours. We plan around ${FOCUS_HOURS_PER_DAY} focus hours a working day, ${perPerson}h expected so far in ${chosen.length === 1 ? "the sprint" : "these sprints"} — the bar shows how you compare.`}
      />

      <SprintPicker sprints={datedSprints} selectedIds={chosen.map((s) => s.id)} onChange={setSprints} />

      <ScopeTabs scope={scope} onChange={setScope} />

      {everyone ? (
        <EveryoneView
          sprints={chosen}
          entries={inSprints}
          people={[...new Set(users.map((u) => u.name))]}
          pods={poolPods}
          tasks={items.filter((i) => chosenSet.has(chosen.find((s) => s.name === i.sprint)?.id ?? "") || (i.sprint === "Unplanned" && chosen.some((s) => s.status === "Active")))}
          podNames={Object.fromEntries(allPods.map((p) => [p.id, p.name]))}
          details={Object.fromEntries(users.map((u) => [u.name, u.role]))}
          perPerson={perPerson}
          updatedAt={work.updatedAt}
          onRefresh={work.refresh}
        />
      ) : (
        <>
          <section className={`${card} grid gap-4 sm:grid-cols-2`}>
            <SelectField
              label="Hi — who's this?"
              required
              value={person}
              onChange={() => {}}
              options={user ? [{ value: user.name, label: `${user.name} (${user.email})` }] : []}
              placeholder="Choose your name"
            />
            {/* The Team is the one saved on the user by an Admin; it can't be changed from here. */}
            <SelectField label="Team" disabled value={myTeam} onChange={() => {}} options={USER_TEAMS} placeholder="No team assigned" />
          </section>

          <section className={`${card} flex flex-col gap-5`}>
            <SprintSummary logged={logged} limit={sprintLimit} expected={expected} hasPerson={!!person} />
            {chosen.map((s) => (
              <div key={s.id} className="border-t border-border pt-5">
                <SprintGlance
                  sprint={s}
                  entries={scoped.filter((e) => e.sprintId === s.id)}
                  showPerson={false}
                  title={chosen.length === 1 ? undefined : `${s.name} at a glance`}
                />
              </div>
            ))}
          </section>

          <section className={card}>
            <SprintPodTasks sprints={chosen} pods={pods} items={myTasks} selection={selection} loggedBySprint={loggedBySprint}
              person={person}
              entries={work.entries.filter((e) => e.person === person)}
              allTasks={[...items, ...hiddenItems]}
              allSprints={sprints}
              onToggle={toggleTask}
            />
          </section>

          <section className={card} aria-label="Log your time">
            <h2 className="mb-4 text-sm font-semibold">{editing ? `Changing “${editing.task}”` : "Log your time"}</h2>
            <WorkForm
              key={`${formSprint.id}-${formKey}`}
              sprint={formSprint}
              pod={mixedPod}
              tasks={selectedTasks}
              person={person}
              editing={editing}
              today={today}
              closed={formSprint.status === "Closed"}
              onHoursChange={setDraftHours}
              onRemoveTask={(t) => toggleTask({ id: selection?.sprintId ?? "" }, selectedPod ?? ({ id: selection?.podId ?? "", name: "" } as Pod), t)}
              onSubmit={submit}
              onCancelEdit={() => (setEditing(null), setSelection(null), setFormKey((k) => k + 1))}
            />
          </section>

          <section className={card}>
            <WorkEntriesList title="Your sprint so far" entries={scoped} showPerson={false} onChange={startEditing} onRemove={setRemoving} />
          </section>
        </>
      )}

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
