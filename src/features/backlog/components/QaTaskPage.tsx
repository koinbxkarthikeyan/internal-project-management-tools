"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { StatusBadge } from "@/components/ui/Badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import { sprintLabel } from "@/constants/backlog-options";
import { MY_TASK_HREF, READY_FOR_QA_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getErrorMessage } from "@/lib/apiClient";
import { readPref, writePref } from "@/lib/preference";
import * as backlogService from "@/services/backlogService";
import type { BacklogItemData } from "@/types/backlog";
import BackLink from "./BackLink";
import ReopenDialog, { canReopenItem } from "./ReopenDialog";
import QaTaskMeta from "./QaTaskMeta";
import QaStatusDialog from "./QaStatusDialog";
import ViewTaskDrawer from "@/features/work/components/ViewTaskDrawer";
import TaskDetailsColumns from "./TaskDetailsColumns";
import TaskWorkspace, { type WorkspaceView } from "./TaskWorkspace";
import { ticketsVisible } from "../ticketVisibility";

/** A task as a full page. From Ready for QA: its details, status, Tickets (with Create Ticket), history and comments. From My Task: its header and the Tickets board only. Back returns to Ready for QA. */
export default function QaTaskPage() {
  const router = useRouter();
  // Opened from My Task or from Ready for QA: Back (and the Tickets' pages) stay in the section it came from.
  const mine = usePathname().startsWith(MY_TASK_HREF);
  const base = mine ? { href: MY_TASK_HREF, label: "Back to My Task" } : { href: READY_FOR_QA_HREF, label: "Back to QA Workspace" };
  const pathname = usePathname();
  const params = useSearchParams();
  const id = Number(params.get("id"));
  // The layout (List View unless the address says Board View) and the selected Ticket live in the address, so a refresh or a shared link comes back to the same place.
  // The layout is also remembered, so coming back from a Ticket, or opening another task, keeps the one last chosen.
  const asked = params.get("view");
  const view: WorkspaceView = (asked ?? readPref("taskLayout")) === "board" ? "board" : "list";
  const ticketCode = params.get("ticket");
  const setParams = (patch: Record<string, string | null>) => {
    if (patch.view) writePref("taskLayout", patch.view);
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const { user, isQa, isAdmin } = useAuth();
  const [item, setItem] = useState<BacklogItemData | null>(null);
  const [error, setError] = useState("");
  const [reopening, setReopening] = useState(false);
  // The main task's full details, opened by the arrow beside the Owner name.
  const [more, setMore] = useState(false);
  const header = useRef<HTMLDivElement>(null);
  // The details float over the page like a menu: a click outside them or Escape closes them.
  useEffect(() => {
    if (!more) return;
    const away = (e: MouseEvent) => !header.current?.contains(e.target as Node) && setMore(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => (document.removeEventListener("mousedown", away), document.removeEventListener("keydown", esc));
  }, [more]);
  // Opening a task for testing happens here, on the task's own page (its status can be changed once all Tickets are Done).
  const [asking, setAsking] = useState(false);

  const invalid = !Number.isInteger(id) || id <= 0;
  const load = useCallback(() => {
    if (invalid) return;
    backlogService.getItemByApiId(id).then(
      (task) => (setItem(task), setError("")),
      (err) => setError(getErrorMessage(err)),
    );
  }, [id, invalid]);
  useEffect(load, [load]);

  if (error || invalid) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href={base.href} label={base.label} />
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error || "That task isn't available."}</p>
      </div>
    );
  }
  if (!item) return <PageSkeleton />;

  // Create Ticket is offered to everybody once the task is with QA (Ready for QA or Testing).
  const withQa = item.status === "Ready for QA" || item.status === "Testing";
  // Before QA (To Do, In Progress) the task has no Tickets section: its details and comments sit in two columns and there is no List / Board choice.
  const tickets = ticketsVisible(item.status);
  const canCreate = withQa;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={base.href} label={base.label} />
      <div ref={header} className="relative flex flex-col gap-6">
      <PageHeader
        title={item.title}
        description={
          <span className="flex flex-wrap items-center gap-x-1.5">
            {item.id}{item.type ? ` · ${item.type}` : ""} · {sprintLabel(item.sprint)} · Owner {item.owner}
            {tickets && !(mine && !withQa) && (
              <button
                type="button"
                onClick={() => setMore((m) => !m)}
                aria-expanded={more}
                aria-label={more ? "Hide task details" : "Show more task details"}
                title={more ? "Hide task details" : "More task details"}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-hover text-foreground transition-colors hover:bg-border focus-visible:outline-2 focus-visible:outline-accent"
              >
                <ChevronRightIcon width={14} height={14} className={`transition-transform ${more ? "rotate-90" : ""}`} />
              </button>
            )}
          </span>
        }
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {tickets && (
            <div role="group" aria-label="Layout" className="flex overflow-hidden rounded-lg border border-border text-xs font-medium">
              {(["list", "board"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setParams({ view: v })}
                  className={`h-8 px-3 focus-visible:outline-2 focus-visible:outline-accent ${view === v ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover"}`}
                >
                  {v === "list" ? "List" : "Board"}
                </button>
              ))}
            </div>
            )}
            {!mine && (isQa || isAdmin) && item.status === "Ready for QA" && (
              <button type="button" onClick={() => setAsking(true)} className="btn-brand h-8 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Open for testing</button>
            )}
            {canReopenItem(item, undefined, user, isAdmin, isQa) && (
              <button type="button" onClick={() => setReopening(true)} className="h-8 rounded-lg border border-border px-3 text-xs font-semibold text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
                Reopen
              </button>
            )}
            <StatusBadge status={item.status} />
          </span>
        }
      />
      {tickets && !(mine && !withQa) && <QaTaskMeta task={item} />}
      {more && tickets && !(mine && !withQa) && (
        <div className="anim-menu-in absolute inset-x-0 top-full z-30 mt-2 max-h-[min(36rem,calc(100dvh-8rem))] overflow-y-auto overscroll-contain rounded-2xl shadow-menu">
          <ViewTaskDrawer key={`${item.id}:${item.status}`} inline hideComments item={item} onClose={() => setMore(false)} onSaved={load} />
        </div>
      )}
      </div>
      {!tickets ? (
        <TaskDetailsColumns item={item} onChanged={load} onBack={() => router.push(base.href)} />
      ) : (
      <TaskWorkspace
        key={item.id}
        item={item}
        view={view}
        selectedCode={ticketCode}
        canCreate={canCreate}
        compact={!(mine && !withQa)}
        canChangeStatus={isQa || isAdmin}
        onChanged={load}
        onBack={() => router.push(base.href)}
      />
      )}
      {asking && (
        <QaStatusDialog
          task={item}
          status="Testing"
          title="Open for testing"
          confirm="Open"
          placeholder="What will you test?"
          onClose={() => setAsking(false)}
          onDone={load}
        />
      )}
      {reopening && <ReopenDialog item={item} onClose={() => setReopening(false)} onReopened={() => load()} />}
    </div>
  );
}
