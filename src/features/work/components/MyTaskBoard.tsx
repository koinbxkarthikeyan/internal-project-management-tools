"use client";

import { useEffect, useState } from "react";
import { TaskDetailsBody, useOpenKey } from "./TaskPopover";
import { TaskAssignees } from "@/components/ui/AssigneeStack";
import { PriorityBadge } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { TextAreaField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { ChevronRightIcon } from "@/components/ui/icons";
import { STATUSES, sprintLabel, statusLabel } from "@/constants/backlog-options";
import BacklogDrawer from "@/features/backlog/components/BacklogDrawer";
import { statusOptionsFor } from "@/features/backlog/statusOptions";
import { formatDeadline } from "@/features/backlog/utils";
import type { BacklogItemData, Status } from "@/types/backlog";

// The cards of the most urgent tasks carry a soft tint (literal class names, so Tailwind generates them); the rest are plain.
const TINT: Partial<Record<BacklogItemData["priority"], string>> = {
  Critical: "border-red-200 bg-red-50 hover:border-red-300 dark:border-red-500/30 dark:bg-red-500/10",
  High: "border-orange-200 bg-orange-50 hover:border-orange-300 dark:border-orange-500/30 dark:bg-orange-500/10",
};

type Props = {
  items: readonly BacklogItemData[];
  onOpen: (item: BacklogItemData) => void;
  caption: string;
  /** May the signed-in person change this task's status (the Lead or an assigned user; the same rule as the task panel)? */
  canMove: (item: BacklogItemData) => boolean;
  /** Saves the new status (with the reason, for Blocked / On hold). Resolves to whether it was saved. */
  onMove: (item: BacklogItemData, status: Status, reason: string) => Promise<boolean>;
};

/**
 * The same tasks as the list, as a board: one column per status, a card per task. A card opens the task like a row does. A card the person may change is dragged to another column to
 * change its status; Blocked and On hold ask why first (the same rule as the task panel). Cards they may not change cannot be picked up.
 */
export default function MyTaskBoard({ items, onOpen, caption, canMove, onMove }: Props) {
  const toast = useToast();
  const [dragging, setDragging] = useState<BacklogItemData | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [asking, setAsking] = useState<{ item: BacklogItemData; status: Status } | null>(null);
  const [reason, setReason] = useState("");
  // Ctrl+F opens the open card's Task details panel.
  const [openId, setOpenId] = useState<string | null>(null);
  // Only the card whose arrow was clicked is open. Its column widens to make room for the details and the other columns narrow (nothing is laid over anything); opening another closes it.
  const toggleCard = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const openCard = items.find((t) => t.id === openId);
  useOpenKey(openCard ? () => onOpen(openCard) : null);
  // Esc (innermost first: an open list or calendar in the card takes its own Esc) or a click outside the open card closes it.
  useEffect(() => {
    if (!openId) return;
    const card = () => document.querySelector<HTMLElement>(`[data-task="${CSS.escape(openId)}"]`);
    const away = (e: PointerEvent) => !card()?.contains(e.target as Node) && setOpenId(null);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("dialog[open]") || card()?.querySelector('[data-card-details] [aria-expanded="true"]')) return;
      e.stopPropagation();
      setOpenId(null);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [openId]);

  function drop(status: Status) {
    const item = dragging;
    setDragging(null);
    setOver(null);
    if (!item || item.status === status) return;
    if (!statusOptionsFor(item).some((o) => o.value === status)) return void toast.show(`${item.title} can't be moved to ${statusLabel(status)}.`, "info");
    if (status === "Blocked" || status === "On hold") {
      setReason("");
      return setAsking({ item, status });
    }
    void onMove(item, status, "");
  }

  return (
    <section aria-label={caption} className="overflow-x-auto pb-1">
      <div
        className="grid min-w-[60rem] items-start gap-3 transition-[grid-template-columns] duration-200"
        style={{ gridTemplateColumns: STATUSES.map((st) => (openCard?.status === st ? "minmax(0,2.6fr)" : "minmax(0,1fr)")).join(" ") }}
      >
        {STATUSES.map((status) => {
          const column = items.filter((t) => t.status === status);
          const target = !!dragging && over === status && dragging.status !== status;
          return (
            <div
              key={status}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOver(status);
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver((o) => (o === status ? null : o))}
              onDrop={(e) => (e.preventDefault(), drop(status))}
              className={`flex min-h-64 min-w-0 flex-col gap-3 rounded-2xl border p-3 transition-colors ${target ? "border-accent bg-accent-soft/60" : "border-border bg-surface"}`}
            >
              <div className="flex items-center gap-2 px-1 pt-0.5">
                <h3 className="truncate text-sm font-semibold">{statusLabel(status)}</h3>
                <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium tabular-nums text-muted">{column.length}</span>
              </div>
              {column.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border py-4">
                  <EmptyState compact title={dragging ? "Drop here" : "No tasks"} />
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {column.map((item) => {
                    const movable = canMove(item);
                    return (
                      <li key={item.id}>
                        <div
                          data-task={item.id}
                          draggable={movable && openId !== item.id}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", item.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragging(item);
                          }}
                          onDragEnd={() => (setDragging(null), setOver(null))}
                          title={movable && openId !== item.id ? "Drag to another column to change its status" : undefined}
                          className={`flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-[border-color,box-shadow,opacity] duration-150 hover:shadow-sm w-full ${TINT[item.priority] ?? "border-border bg-surface hover:border-accent/50"} ${movable ? "cursor-grab active:cursor-grabbing" : ""} ${dragging?.id === item.id ? "opacity-40" : ""}`}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="flex min-w-0 items-start gap-1.5">
                              <button type="button" onClick={() => onOpen(item)} aria-label={`View ${item.title}`} className="line-clamp-2 min-w-0 text-left text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-accent">{item.title}</button>
                              <button
                                type="button"
                                onClick={() => toggleCard(item.id)}
                                aria-expanded={openId === item.id}
                                aria-label={`${openId === item.id ? "Hide" : "Show"} details of ${item.title}`}
                                className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-background/70 text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
                              >
                                <ChevronRightIcon width={12} height={12} className={`transition-transform duration-150 ${openId === item.id ? "-rotate-90" : ""}`} />
                              </button>
                            </span>
                            <TaskAssignees passive hideEmpty item={item} size={22} />
                          </span>
                          <span className="flex items-center gap-3 text-xs">
                            <span className="font-mono text-muted">{item.id}</span>
                            <PriorityBadge priority={item.priority} />
                          </span>
                          <span className="flex flex-col gap-0.5 text-[11px] text-muted">
                            <span>{[item.type, sprintLabel(item.sprint)].filter(Boolean).join(" · ")}</span>
                            <span>Expected ETA: {item.deadline ? formatDeadline(item.deadline) : "–"}</span>
                            <span>Developer ETA: {item.leadDeadline ? formatDeadline(item.leadDeadline) : "–"}</span>
                          </span>
                          {openId === item.id && (
                            <div data-card-details className="mt-1 flex cursor-default flex-col gap-3 border-t border-border/70 pt-3" onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={() => onOpen(item)} className="flex w-fit items-center gap-1.5 text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
                                Open full details <kbd className="rounded border border-border px-1 font-sans text-[10px] font-normal text-muted">Ctrl F</kbd>
                              </button>
                              <TaskDetailsBody item={item} />
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {asking && (
        <BacklogDrawer
          heading={`Move to ${statusLabel(asking.status)}`}
          subtitle={asking.item.title}
          submitLabel="Move task"
          compact
          onSubmit={async () => {
            if (!reason.trim()) return false;
            const saved = await onMove(asking.item, asking.status, reason.trim());
            return saved ? undefined : false;
          }}
          canSubmit={!!reason.trim()}
          onClose={() => setAsking(null)}
        >
          <TextAreaField label="Why is it blocked or on hold?" required value={reason} onChange={setReason} rows={3} />
        </BacklogDrawer>
      )}
    </section>
  );
}
