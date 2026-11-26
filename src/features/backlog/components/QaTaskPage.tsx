"use client";

import ViewToggle from "@/components/ui/ViewToggle";
import { useIsPhone } from "@/hooks/useIsPhone";
import TaskChatButton from "@/features/messages/components/TaskChatButton";
import { useMenuPresence } from "@/hooks/usePresence";
import { disclosureKeys } from "@/lib/disclosureKeys";
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
  const phone = useIsPhone();
  // A phone has no Board view: it always shows the list.
  const view: WorkspaceView = !phone && (asked ?? readPref("taskLayout")) === "board" ? "board" : "list";
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
  const detailsMenu = useMenuPresence(more);
  const panel = useRef<HTMLDivElement>(null);
  const toggler = useRef<HTMLButtonElement>(null);
  // The details float over the page like a menu: a click (or tap) anywhere outside them, other than on their own arrow button, or Escape closes them.
  useEffect(() => {
    if (!more) return;
    const away = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      // A form or list opened from inside the details (drawn on the page itself) is part of them.
      if (t.closest?.("dialog, [role=dialog], [popover]")) return;
      if (!panel.current?.contains(t) && !toggler.current?.contains(t)) setMore(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => (document.removeEventListener("pointerdown", away), document.removeEventListener("keydown", esc));
  }, [more]);
  // Down arrow opens the details (↑ closes them), as long as the person isn't typing, choosing from a list, or in a form; the arrow keys keep scrolling the page otherwise.
  const canMore = !!item && ticketsVisible(item.status) && !(mine && !(item.status === "Ready for QA" || item.status === "Testing"));
  useEffect(() => {
    if (!canMore) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowDown" && e.key !== "ArrowUp") || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=''], [contenteditable=true], [role=combobox], [role=listbox], [role=menu], [role=option], [role=menuitem]")) return;
      if (document.querySelector("dialog[open]")) return;
      if ((e.key === "ArrowDown") === more) return;
      e.preventDefault();
      setMore(e.key === "ArrowDown");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [canMore, more]);
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
    <div className="flex flex-col gap-4 sm:gap-6">
      <BackLink href={base.href} label={base.label} />
      <div className="relative flex flex-col gap-3 sm:gap-6">
      <PageHeader
        oneLine
        title={item.title}
        description={
          <span className="flex items-center gap-x-1.5">
            {/* One line: the text shortens with "…" when the screen is narrow (no "Owner" word on a phone), the arrow always stays beside it. */}
            <span className="min-w-0 truncate">{item.id}{item.type ? ` · ${item.type}` : ""} · {sprintLabel(item.sprint)} · <span className="hidden sm:inline">Owner </span>{item.owner}</span>
            {tickets && !(mine && !withQa) && (
              <button
                ref={toggler}
                type="button"
                onClick={() => setMore((m) => !m)}
                onKeyDown={disclosureKeys(more, () => setMore((m) => !m))}
                aria-expanded={more}
                aria-keyshortcuts="ArrowDown ArrowUp"
                data-disclosure
                aria-label={more ? "Hide task details" : "Show more task details"}
                title={more ? "Hide task details (Up arrow)" : "More task details (Down arrow)"}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-hover text-foreground transition-colors hover:bg-border focus-visible:outline-2 focus-visible:outline-accent"
              >
                <ChevronRightIcon width={14} height={14} className={`transition-transform ${more ? "rotate-90" : ""}`} />
              </button>
            )}
          </span>
        }
        actions={
          <span className="flex items-center gap-2 sm:flex-wrap">
            {item.apiId != null && <TaskChatButton taskId={item.apiId} />}
            {tickets && (
            <ViewToggle value={view} onChange={(v) => setParams({ view: v })} label="Layout" />
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
      {/* On a phone this row is inside the details dropdown (the arrow by the title) instead of under the title. */}
      {tickets && !(mine && !withQa) && <div className="hidden sm:block"><QaTaskMeta task={item} /></div>}
      {detailsMenu.mounted && tickets && !(mine && !withQa) && (
        <div ref={panel} className={`${detailsMenu.motion} absolute inset-x-0 top-full z-30 mt-2 rounded-2xl shadow-menu`}>
          <div className="mb-2 card px-4 py-3 sm:hidden"><QaTaskMeta task={item} inline /></div>
          <ViewTaskDrawer key={`${item.id}:${item.status}`} inline fit hideComments item={item} onClose={() => setMore(false)} onSaved={load} />
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
