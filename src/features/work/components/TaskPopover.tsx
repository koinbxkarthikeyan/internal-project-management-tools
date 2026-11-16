"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatDeadline } from "@/features/backlog/utils";
import { useItemDetailStore } from "@/stores/itemDetailStore";
import type { BacklogItemData } from "@/types/backlog";
import TaskQuickEdit from "./TaskQuickEdit";

/** Ctrl+F (⌘F) while a task's popup is open: opens that task's Task details panel, instead of the browser's find bar. Not while a panel is already open. */
export function useOpenKey(run: (() => void) | null) {
  useEffect(() => {
    if (!run) return;
    const on = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "f" || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [run]);
}

const WIDTH = 576; // 36rem

/**
 * A task's details and the fields its person may change, in a popup next to the arrow that opened it, over the page: nothing in the table or board moves. The task's own detail is read when
 * it opens (the lists leave some fields out). A click outside, Esc, or the arrow again closes it; "Open full details" (or Ctrl+F) opens the Task details panel.
 */
/**
 * What a task's details show: the task's own detail is read when it opens (the lists leave some fields out), then the details and the fields the person may change. `compact` (inside a card)
 * stacks everything in one column; otherwise two.
 */
export function TaskDetailsBody({ item, compact = false }: { item: BacklogItemData; compact?: boolean }) {
  const [detail, setDetail] = useState<BacklogItemData | null>(null);
  useEffect(() => {
    let live = true;
    useItemDetailStore.getState().get(item.id).then((d) => live && setDetail(d), () => {});
    return () => {
      live = false;
    };
  }, [item.id]);
  const t = detail ? { ...item, ...detail } : item;
  const rows: [string, string | undefined][] = [
    ["Owner", t.owner && t.owner !== "Unassigned" ? t.owner : undefined],
    ["Lead", t.lead],
    ["Assignees", t.assignees],
    ["Description", t.description],
    ["Notes", t.notes],
    ["Created", t.created ? `${formatDeadline(t.created)}${t.createdBy ? ` by ${t.createdBy}` : ""}` : undefined],
    ["Last updated", t.updatedAt ? `${formatDeadline(t.updatedAt.slice(0, 10))}${t.updatedBy ? ` by ${t.updatedBy}` : ""}` : undefined],
    ["Done on", t.completed ? formatDeadline(t.completed) : undefined],
    ...(t.blockedReason ? ([[`Why it is ${t.status.toLowerCase()}`, t.blockedReason]] as [string, string][]) : []),
  ];
  return (
    <>
      <dl className={compact ? "flex flex-col divide-y divide-border/60 text-xs" : "grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2"}>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className={compact ? "flex flex-col gap-0.5 py-1.5 first:pt-0" : k === "Description" || k === "Notes" || k.startsWith("Why") ? "sm:col-span-2" : ""}>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{k}</dt>
            <dd className={`${compact ? "line-clamp-3" : "line-clamp-4"} whitespace-pre-line break-words text-foreground`}>{v}</dd>
          </div>
        ))}
      </dl>
      {detail && <TaskQuickEdit key={`${item.id}:${item.status}`} item={t} wide={!compact} />}
    </>
  );
}

export default function TaskPopover({ item, anchor, onClose, onOpen }: { item: BacklogItemData; anchor: HTMLElement; onClose: () => void; onOpen: () => void }) {
  useOpenKey(onOpen);
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number; max: number } | null>(null);
  // Under the task (or above it when there is no room below), kept inside the window; it re-places itself when its content grows.
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor.isConnected) return onClose(); // the row / card it hung from is gone (another tab or view)
      const r = anchor.getBoundingClientRect();
      const w = Math.min(WIDTH, window.innerWidth - 16);
      const h = box.current?.offsetHeight ?? 0;
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = h > below && above > below;
      const max = Math.max(240, up ? above : below);
      setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top: up ? Math.max(8, r.top - 6 - Math.min(h, max)) : r.bottom + 6, max });
    };
    place();
    const ro = new ResizeObserver(place);
    if (box.current) ro.observe(box.current);
    window.addEventListener("resize", place);
    return () => (ro.disconnect(), window.removeEventListener("resize", place));
  }, [anchor, onClose]);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      const el = e.target as Node;
      if (!box.current?.contains(el) && !anchor.contains(el)) onClose();
    };
    // Esc closes the innermost thing first: an open list or calendar inside the popup handles its own Esc; with none open, the popup closes.
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector("dialog[open]") || box.current?.querySelector('[aria-expanded="true"]')) return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc, true);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label={`Details of ${item.title}`}
      style={{ left: at?.left ?? 0, top: at?.top ?? 0, maxHeight: at?.max, width: Math.min(WIDTH, typeof window === "undefined" ? WIDTH : window.innerWidth - 16), visibility: at ? "visible" : "hidden" }}
      className="fixed z-50 flex flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-menu"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{item.title}</p>
          <p className="font-mono text-xs text-muted">{item.id}</p>
        </div>
        <button type="button" onClick={onOpen} className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
          Open full details <kbd className="rounded border border-border px-1 font-sans text-[10px] font-normal text-muted">Ctrl F</kbd>
        </button>
      </div>
      <TaskDetailsBody item={item} />
    </div>,
    document.body,
  );
}
