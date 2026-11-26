"use client";

import TabSwap from "@/components/ui/TabSwap";
import { useEffect, useRef, useState } from "react";
import { usePresence } from "@/hooks/usePresence";
import { useCollapseSidebar } from "@/hooks/useCollapseSidebar";
import { useFitToScreen } from "@/hooks/useFitToScreen";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { statusLabel } from "@/constants/backlog-options";
import { MESSAGES_LABEL, MY_TASK_HREF, READY_FOR_QA_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import ViewTaskDrawer from "@/features/work/components/ViewTaskDrawer";
import type { BacklogItemData, Status } from "@/types/backlog";
import { statusOptionsFor } from "../statusOptions";
import { NO_TICKET_FILTERS, filterTickets, type TicketFilters, type TicketGroupBy } from "../ticketFilters";
import QaTaskSummary from "./QaTaskSummary";
import TaskTickets from "./TaskTickets";
import TicketFilterBar from "./TicketFilterBar";

export type WorkspaceView = "list" | "board";

/**
 * The Main Task page's two interchangeable layouts over the same task and Tickets (nothing is copied when switching: both read the same records).
 * List View: the filters full width on top, the Tickets as an expandable list on the left, the task's details and comments on the right.
 * Board View: the status board on top (cards can be dragged to another column), the task's details underneath. A Ticket opens as its own full page.
 * The selected Ticket, the filters and the search live here, so they stay as they are when the view is switched.
 */
export default function TaskWorkspace({ item, view, selectedCode, canCreate, compact, canChangeStatus, onChanged, onBack }: { item: BacklogItemData; view: WorkspaceView; selectedCode: string | null; canCreate: boolean; /** Show the task's short details (with its comments) instead of the full task panel: on the QA pages and once a task is with QA. */ compact: boolean; /** The QA team and the admins may change the task's status here (once all Tickets are Done). */ canChangeStatus: boolean; onChanged: () => void; onBack: () => void }) {
  const toast = useToast();
  const { user, isQa, isAdmin } = useAuth();
  // The search and filters are kept for this task while the tab is open, so they are still there after opening a Ticket and coming back.
  const filterKey = `koinbx.ticketFilters.${item.id}`;
  const [filters, setFilters] = useState<TicketFilters>(() => {
    try {
      const saved = sessionStorage.getItem(filterKey);
      return saved ? { ...NO_TICKET_FILTERS, ...(JSON.parse(saved) as Partial<TicketFilters>) } : NO_TICKET_FILTERS;
    } catch {
      return NO_TICKET_FILTERS;
    }
  });
  const changeFilters = (f: TicketFilters) => {
    setFilters(f);
    try {
      sessionStorage.setItem(filterKey, JSON.stringify(f));
    } catch {
      /* the filters just are not kept */
    }
  };
  // The grouping of the Tickets (by team) is kept for this task, like the filters, and shared by both layouts.
  const groupKey = `koinbx.ticketGroup.${item.id}`;
  const [groupBy, setGroupBy] = useState<TicketGroupBy>(() => {
    try {
      const v = sessionStorage.getItem(groupKey);
      return v === "assigned" || v === "created" ? v : "";
    } catch {
      return "";
    }
  });
  const changeGroup = (g: TicketGroupBy) => {
    setGroupBy(g);
    try {
      sessionStorage.setItem(groupKey, g);
    } catch {
      /* not kept */
    }
  };
  // The details and comments column is open whenever the page is, and folded only by the person ("Hide comments"); it stays as they leave it while they are on this page.
  // Where the Tickets and the conversation are stacked (under 1400px) only one of them is open at a time: opening one folds the other, and the page starts with the Tickets open.
  const stacked = () => typeof window !== "undefined" && !window.matchMedia("(min-width: 1400px)").matches;
  const [side, setSide] = useState(() => !stacked());
  // The Tickets column folds into a slim "Tickets" rail the same way (by hand), and the conversation then takes the width.
  const [ticketsOpen, setTicketsOpen] = useState(true);
  // The Tickets and the conversation are never both folded: hiding the one that is open opens the other.
  const hideTickets = () => (setTicketsOpen(false), setSide(true));
  const hideChat = () => (setSide(false), setTicketsOpen(true));
  // When the window is made narrower (under 1400px) with both open, the conversation folds and the Tickets stay: only one is open at a time on a narrow screen.
  const both = useRef(false);
  useEffect(() => {
    both.current = side && ticketsOpen;
  }, [side, ticketsOpen]);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1400px)");
    const onChange = () => {
      if (!mq.matches && both.current) setSide(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  // The column eases open and closed (its width, and its content fading), and its content is only in the page while it is open or closing.
  const panel = usePresence(side);
  // Where the right panel is the conversation (the short details with the chat), the Tickets and the conversation are one row of two panels of the same height, fitted to the screen, in both
  // views. Where it is the full task details (a long page of its own) the row keeps its natural heights.
  const row = useFitToScreen<HTMLDivElement>();
  const match = compact;
  // Board View: while the person is in the conversation (typing, or any tool of it has focus) the sidebar collapses and the conversation widens, to give it room; both return when they leave it.
  const [chatFocus, setChatFocus] = useState(false);
  const focusChat = view === "board" && match && side && chatFocus;
  useCollapseSidebar(focusChat);
  const [tickets, setTickets] = useState<BacklogItemData[] | null>(null);
  // Bumped when a Ticket is made from the comments section, so the Tickets block reads its list again.
  const [ticketsToken, setTicketsToken] = useState(0);

  // A Ticket opens as its own full page; coming back to the task keeps it marked.
  const router = useRouter();
  const area = usePathname().startsWith(MY_TASK_HREF) ? MY_TASK_HREF : READY_FOR_QA_HREF;
  const open = (t: BacklogItemData, status?: Status) => router.push(`${area}/ticket?id=${t.apiId}${status ? `&status=${encodeURIComponent(status)}` : ""}`);
  const selected = selectedCode && tickets ? (tickets.find((t) => t.id === selectedCode) ?? null) : null;

  function move(t: BacklogItemData, to: Status) {
    const mine = !!user && (t.assigneeIds ?? []).includes(user.id);
    if (t.status === "Done") return toast.show("Use Reopen to change a completed Ticket.", "danger");
    const creator = !!user && t.createdById === user.id;
    if (!(isQa || isAdmin || mine || creator) || !statusOptionsFor(t, isAdmin, isAdmin || isQa, creator).some((o) => o.value === to)) return toast.show(`You can't move ${t.id} to ${statusLabel(to)}.`, "danger");
    toast.show(`Write the comment for moving ${t.id} to ${statusLabel(to)}, then press Save status.`, "info");
    open(t, to);
  }

  const ticketsBlock = (variant: "tree" | "board") => (
    <TaskTickets
      task={item}
      canCreate={canCreate}
      reloadToken={ticketsToken}
      variant={variant}
      selectedId={selected?.id}
      filters={filters}
      groupBy={groupBy}
      onTickets={setTickets}
      onOpen={(t) => open(t)}
      onMove={variant === "board" ? move : undefined}
      onChanged={onChanged}
      onHide={hideTickets}
      // On the board the sidebar collapses for an open card only while the comments column is open too (both take width); with the column folded there is room.
      collapseSidebar={side}
    />
  );

  const taskPanel = compact ? (
    <QaTaskSummary task={item} tickets={tickets} canChangeStatus={canChangeStatus} canCreate={canCreate} onTicketCreated={() => setTicketsToken((n) => n + 1)} onChanged={onChanged} onHide={hideChat} />
  ) : (
    <ViewTaskDrawer key={`${item.id}:${item.status}`} inline fit={area === MY_TASK_HREF} item={item} onClose={onBack} onSaved={onChanged} />
  );

  // The Tickets column: the block itself, or (folded) a slim rail that opens it again.
  const ticketsColumn = (variant: "tree" | "board") =>
    ticketsOpen ? (
      <div className={`min-w-0 flex-1 ${match ? "[&>*]:h-full" : ""}`}>{ticketsBlock(variant)}</div>
    ) : (
      <div className="w-[3.25rem] shrink-0">
        <button type="button" onClick={() => (setTicketsOpen(true), stacked() && setSide(false))} aria-expanded="false" title="Show Tickets" className="anim-fade-up flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-medium text-muted transition-colors duration-150 hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent flex-col px-1 py-4">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></svg>
          <span className="[writing-mode:vertical-rl]">Tickets</span>
        </button>
      </div>
    );
  const sideWidth = (w: string) => (ticketsOpen ? w : "w-auto flex-1");

  // The search and filters sit above the Tickets block, outside it, in both layouts.
  const filterBar =
    tickets && tickets.length > 0 ? (
      <div className="-mt-3">
        <TicketFilterBar tickets={tickets} filters={filters} onChange={changeFilters} shown={filterTickets(tickets, filters).length} groupBy={groupBy} onGroupBy={changeGroup} />
      </div>
    ) : null;

  // The details and comments column, the same in both views: open, or folded into a slim "Comments" rail (opened and folded by hand); it eases between the two.
  // Its width is what eases (a length to a length, which every browser animates); the open content keeps a minimum width so it is clipped, not squeezed, while it moves.
  const sideColumn = (openWidth: string) => (
    <div
      onFocus={() => setChatFocus(true)}
      onBlur={(e) => {
        const next = e.relatedTarget as HTMLElement | null;
        if (!next || !(e.currentTarget.contains(next) || next.closest?.("[data-composer-panel]"))) setChatFocus(false);
      }}
      className={`relative min-w-0 transition-[width] duration-200 ease-out motion-reduce:transition-none shrink-0 overflow-hidden ${side ? (focusChat ? "min-[1400px]:w-[32rem]" : openWidth) : "w-[3.25rem]"} ${match ? "h-full" : "sticky top-4"}`}>
      {panel.mounted && (
        <div className={`flex flex-col transition-opacity duration-200 motion-reduce:transition-none min-[1400px]:min-w-[22rem] ${match ? "h-full" : ""} ${panel.shown ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {!compact && (
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={hideChat} aria-expanded="true" className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Hide {MESSAGES_LABEL.toLowerCase()} ›</button>
            </div>
          )}
          <div className={match ? "min-h-0 flex-1" : ""}>{taskPanel}</div>
        </div>
      )}
      {!side && (
        <button type="button" onClick={() => (setSide(true), stacked() && setTicketsOpen(false))} aria-expanded="false" title={`Show ${MESSAGES_LABEL.toLowerCase()} and activity`} className="anim-fade-up flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-medium text-muted transition-colors duration-150 hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent flex-col px-1 py-4">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" /></svg>
          <span className="[writing-mode:vertical-rl]">{MESSAGES_LABEL}</span>
        </button>
      )}
    </div>
  );

  if (view === "board") {
    return (
      <TabSwap id="board" className="flex flex-col gap-4">
        {filterBar}
        {/* The status board takes the width; the task's comments are a narrow column beside it (under it on a small screen). */}
        <div ref={match ? row : undefined} className={`flex flex-row gap-4 ${match ? "items-stretch" : "items-start"}`}>
          {ticketsColumn("board")}
          {sideColumn(sideWidth("min-[1400px]:w-[22rem]"))}
        </div>
      </TabSwap>
    );
  }
  // List View: the filters on top, the Tickets on the left, the task's details or comments on the right.
  return (
    <TabSwap id="list" className="flex flex-col gap-4">
      {filterBar}
      <div ref={match ? row : undefined} className={`flex flex-row gap-4 ${match ? "items-stretch" : "items-start"}`}>
        {ticketsColumn("tree")}
        {sideColumn(sideWidth("min-[1400px]:w-[calc(50%-0.5rem)]"))}
      </div>
    </TabSwap>
  );
}
