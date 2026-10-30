"use client";

import { DisabledTip } from "@/components/ui/DisabledTip";
import Link from "next/link";
import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { FOCUS_HOURS_PER_DAY, WORK_KINDS, SPRINT_TASKS_POD, UNPLANNED_POD, WORK_LOGGED_HREF, isPseudoPod } from "@/constants/work";
import ConfirmDeleteDrawer from "@/features/backlog/components/ConfirmDeleteDrawer";
import { Field, SearchableSelect } from "@/components/ui/FormControls";
import { refreshUsers } from "@/lib/auth/userStore";
import { teamOptions } from "@/lib/auth/teams";
import { resolveTeam, useTeamStore } from "@/stores/teamStore";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useMyTasksStore } from "@/stores/myTasksStore";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { todayISO } from "@/features/backlog/utils";
import type { BacklogItemData } from "@/types/backlog";
import type { Pod, WorkEntry, WorkEntryInput, WorkKind } from "@/types/work";
import { useWorkData } from "../hooks/useWorkData";
import { useChosenSprints } from "../hooks/useChosenSprints";
import { formatDay, latestEntry, sprintHours } from "../utils";
import HoursSummaryLine from "./HoursSummaryLine";
import SprintGlance from "./SprintGlance";
import SprintPicker from "./SprintPicker";
import SprintPodTasks, { type TaskSelection } from "./SprintPodTasks";
import SprintSummary from "./SprintSummary";
import StartEditFromUrl from "./StartEditFromUrl";
import WorkEntriesList from "./WorkEntriesList";
import WorkForm from "./WorkForm";

const card = "rounded-2xl border border-border bg-surface p-5";

/** The "What are you working on?" section: independent of the Backlog pages (it only reads sprints, PODs, tasks and owners). */
export default function WorkPage() {
  const toast = useToast();
  const { sprints, pods, items, hiddenItems } = useBacklog();
  const users = useUsers();
  const work = useWorkData();

  const { datedSprints, chosen, setPicked } = useChosenSprints();
  const today = todayISO();

  // Entries are logged as the signed-in registered user, read from the Users data.
  const { user, isAdmin } = useAuth();

  // The My Task page's lists, which the task picker below reuses.
  const mineStore = useMyTasksStore();
  const mineScope = user?.id ?? "";
  const { load: loadMine } = mineStore;
  useEffect(() => {
    if (mineScope) void loadMine(mineScope);
  }, [mineScope, loadMine]);
  const person = user?.name ?? "";
  // Re-read the users when the page opens, so a Team an Admin changed shows up here.
  useEffect(() => {
    void refreshUsers();
  }, []);
  const renames = useTeamStore((s) => s.renames);
  const myTeam = users.find((u) => u.id === user?.id)?.team ?? (user?.team ? resolveTeam(user.team, renames) : "");
  const rawTeam = user?.team ?? "";
  // The kind of work: the supported kind that matches the person's Team when there is one, otherwise none until one is chosen; it can be changed in
  // the form at any time. The Team itself (e.g. Marketing) is never sent as the kind; it stays on the profile.
  const [kindPick, setKindPick] = useState<WorkKind | null>(null);
  // Every kind is a team from the same list the Team Members form offers (plus the five the backend lists), so none is left out.
  const teamDeleted = useTeamStore((s) => s.deleted);
  const teamCustom = useTeamStore((s) => s.custom);
  const kinds = teamOptions(users, WORK_KINDS, { renames, deleted: teamDeleted, custom: teamCustom });
  const kindFromTeam = kinds.find((k) => k.toLowerCase() === (rawTeam || myTeam).trim().toLowerCase());
  const kind: WorkKind | null = kindPick ?? kindFromTeam ?? null;
  // Hours currently in the form, so the bar follows what is being entered.
  const [draft, setDraft] = useState<{ from: string; to: string; hours: number } | null>(null);
  const [selection, setSelection] = useState<TaskSelection | null>(null);
  const [editing, setEditing] = useState<WorkEntry | null>(null);
  // "Other Work": time that is not on a sprint task. Ticking it clears the task ticks; ticking a task clears it.
  const [otherWork, setOtherWork] = useState(false);
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
          className="mt-4 rounded-xl btn-brand px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
            title="No sprint added yet"
            description="Create a sprint to get started, then come back to log your work."
            // Only an Admin can create a sprint, so only they are offered the way to do it.
            action={
              isAdmin ? (
                <Link
                  href="/sprint-plan"
                  className="inline-flex rounded-xl btn-brand px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Create a sprint
                </Link>
              ) : undefined
            }
          />
        </section>
      </div>
    );
  }

  const chosenSet = new Set(chosen.map((s) => s.id));

  const inSprints = work.entries.filter((e) => chosenSet.has(e.sprintId));
  const scoped = inSprints
    .filter((e) => e.person === person)
    .sort((a, b) => a.from.localeCompare(b.from) || a.createdAt.localeCompare(b.createdAt));

  // Expected hours count working days up to today only (weekends excluded); days still to come are not included.
  // A finished sprint counts in full. Hours already logged are never touched by this.
  // What the whole sprint plans for one person (`total`): worked hours beyond this show as the red part of the bar.
  const { soFar: perPerson, total: sprintLimit } = sprintHours(chosen, today);
  const expected = perPerson;
  // My hours in every sprint (earlier ones included), each logged entry counted once.
  const newest = latestEntry(scoped);
  const savedHours = scoped.reduce((sum, e) => sum + e.hours, 0);

  // The form logs against the sprint of the ticked tasks, or the first chosen sprint until something is ticked.
  const formSprint = chosen.find((s) => s.id === selection?.sprintId) ?? chosen[0];
  // This page's hours bar and timeline show only what is in the form now: nothing until a task is ticked, and empty again once the entry is saved
  // (everything already logged is on Your Logged Work).
  const formActive = (!!selection || otherWork) && formSprint.status !== "Closed";
  const logged = formActive && draft ? draft.hours : 0;
  const selectedTasks = selection
    ? selection.itemIds.flatMap((id) => items.filter((i) => i.id === id))
    : [];
  // The entry being filled in, drawn on the timeline as one bar.
  const draftEntries: WorkEntry[] =
    formActive && draft
      ? [{ id: "draft", sprintId: formSprint.id, person, pod: "", kind: kind ?? "Backend", task: otherWork ? "Something else" : selectedTasks.map((t) => t.title).join(", ") || "New entry", from: draft.from, to: draft.to, hours: draft.hours, createdAt: "" }]
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

  // The task picker offers the same tasks as the My Task page (`GET /items/mine`): tasks assigned to me, tasks I lead and unassigned tasks.
  // Each is shown as its newest copy from the shared list, so assignment changes show here too.
  const mineIds = new Set(
    mineStore.scope === mineScope ? [...mineStore.buckets.lead, ...mineStore.buckets.assigned, ...mineStore.buckets.unassigned].map((t) => t.id) : [],
  );
  const myTasks = items.filter((t) => mineIds.has(t.id));

  // Tasks this person already logged, by sprint (the entry being changed doesn't count, so its tasks stay pickable).
  const loggedBySprint: Record<string, Set<string>> = {};
  for (const e of scoped) {
    if (e.id === editing?.id) continue;
    const set = (loggedBySprint[e.sprintId] ??= new Set());
    for (const id of e.itemIds ?? []) set.add(id);
  }

  const sprintNames = chosen.map((s) => s.name).join(", ");

  function setSprints(ids: string[]) {
    setPicked(ids);
    // Ticked tasks from a sprint that was just unticked no longer apply.
    if (selection && !ids.includes(selection.sprintId)) setSelection(null);
    if (editing) setKindPick(null);
    setEditing(null);
    setOtherWork(false);
    setFormKey((k) => k + 1);
  }

  function toggleOtherWork(on: boolean) {
    setOtherWork(on);
    if (on) setSelection(null);
    if (editing) setEditing(null);
    setFormKey((k) => k + 1);
  }

  function toggleTask(sprint: { id: string }, pod: Pod, item: BacklogItemData) {
    if (otherWork) return;
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
      if (editing) setKindPick(null); // back to the kind that matches the Team
      setEditing(null);
      setSelection(null);
      setOtherWork(false);
      setFormKey((k) => k + 1);
    }
    return ok;
  }

  async function remove(entry: WorkEntry) {
    if (!(await work.removeEntry(entry.id))) return false;
    toast.show("Removed from your sprint", "delete");
    if (editing?.id === entry.id) {
      setEditing(null);
      setSelection(null);
      setOtherWork(false);
      setFormKey((k) => k + 1);
    }
  }

  function startEditing(entry: WorkEntry) {
    setEditing(entry);
    setOtherWork(!!entry.otherWork);
    setKindPick(entry.kind); // the entry's own kind, which can be changed
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

  // Other Work and a ticked task are exclusive: any ticked task locks Other Work (a closed sprint locks it too).
  const otherWorkLocked = formSprint.status === "Closed" || (!otherWork && !!selection?.itemIds.length);

  const logForm = (
    <WorkForm
      key={`${formSprint.id}-${formKey}`}
      sprint={formSprint}
      pod={mixedPod}
      tasks={selectedTasks}
      person={person}
      editing={editing}
      today={today}
      closed={formSprint.status === "Closed"}
      kinds={kinds}
      kind={kind}
      onKindChange={setKindPick}
      otherWork={otherWork}
      onDraftChange={setDraft}
      onRemoveTask={(t) => toggleTask({ id: selection?.sprintId ?? "" }, selectedPod ?? ({ id: selection?.podId ?? "", name: "" } as Pod), t)}
      onSubmit={submit}
      onCancelEdit={() => (setEditing(null), setKindPick(null), setSelection(null), setOtherWork(false), setFormKey((k) => k + 1))}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="What are you working on?"
        description={`${rangeText}. Pick what you're on, the dates you're on it, and roughly how many hours. We plan around ${FOCUS_HOURS_PER_DAY} focus hours a working day, ${perPerson}h expected so far in ${chosen.length === 1 ? "the sprint" : "these sprints"} — the bar shows how you compare.`}
      />

      <SprintPicker sprints={datedSprints} selectedIds={chosen.map((s) => s.id)} onChange={setSprints} />

        <>
          <section className={`${card} grid gap-4 sm:grid-cols-2`}>
            <SearchableSelect
              label="Hi — who's this?"
              required
              value={person}
              onChange={() => {}}
              options={user ? [{ value: user.name, label: user.name }] : []}
              hideArrow
              disabled // always the signed-in user (from the session); it is never a choice
              inputClassName="h-10 disabled:cursor-default disabled:opacity-100! disabled:text-foreground! disabled:[-webkit-text-fill-color:var(--foreground)]" // the name stays fully readable
              placeholder={user ? "Choose your name" : "Loading your account…"}
            />
            {/* The person's own Team, as saved on their profile (it is not changed here). */}
            <Field label="Team">
              <p className="flex h-10 items-center rounded-xl border border-border bg-background px-3 text-sm">{myTeam || "Not set"}</p>
            </Field>
          </section>

          <section className={`${card} flex flex-col gap-5`}>
            <SprintSummary logged={logged} limit={sprintLimit} expected={expected} hasPerson={!!person} />
            {chosen.map((s) => (
              <div key={s.id} className="border-t border-border pt-5">
                <SprintGlance
                  sprint={s}
                  entries={draftEntries.filter((e) => e.sprintId === s.id)}
                  showPerson={false}
                  title={chosen.length === 1 ? undefined : `${s.name} at a glance`}
                />
              </div>
            ))}
          </section>

          <section className={card}>
            <SprintPodTasks disabled={otherWork} sprints={chosen} pods={pods} items={myTasks} selection={selection} loggedBySprint={loggedBySprint}
              person={person}
              entries={work.entries.filter((e) => e.person === person)}
              allTasks={[...items, ...hiddenItems]}
              allSprints={sprints}
              everyoneEntries={work.entries}
              onToggle={toggleTask}
            />
            <DisabledTip reason={otherWorkLocked && (formSprint.status === "Closed" ? "This sprint is closed, so time can't be logged against it." : "Unavailable while a task is selected. Untick the selected tasks to use this.")} className="block w-fit">
            <label className={`mt-4 flex w-fit items-center gap-3 text-sm ${otherWorkLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                checked={otherWork}
                disabled={otherWorkLocked}
                onChange={(e) => toggleOtherWork(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="font-medium">Something else - my own task</span>
              <span className="text-xs text-muted">Not on any task above (code review, meetings…)</span>
            </label>
            </DisabledTip>
            {otherWork && <div className="mt-4 border-t border-border pt-4">{logForm}</div>}
          </section>

          {!otherWork && (
          <section className={card} aria-label="Log your time">
            <h2 className="mb-4 text-sm font-semibold">{editing ? `Changing “${editing.task}”` : "Log your time"}</h2>
            {logForm}
          </section>
          )}

          {/* Only the most recently saved entry; every entry is on the Your Logged Work page. */}
          <section className={card}>
            <WorkEntriesList title="Your latest entry" entries={newest ? [newest] : []} hoursLine={<HoursSummaryLine logged={savedHours} soFar={perPerson} total={sprintLimit} />} showPerson={false} onChange={startEditing} onRemove={setRemoving} />
            <div className="mt-3 flex justify-end border-t border-border pt-3">
              <Link
                href={WORK_LOGGED_HREF}
                className="inline-flex h-10 items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
              >
                View all
              </Link>
            </div>
          </section>
        </>

      {/* Opened from Your Logged Work with ?edit=<id>: starts changing that entry here, where the form is. */}
      <StartEditFromUrl entries={work.entries} onEntry={startEditing} />

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
