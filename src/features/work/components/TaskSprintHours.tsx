"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { BacklogItemData, Sprint } from "@/types/backlog";
import type { WorkEntry } from "@/types/work";
import { formatDay, formatHours } from "../utils";
import { sprintLabel } from "@/constants/backlog-options";

type Tone = "current" | "previous";

const TONE: Record<Tone, { chip: string; dot: string }> = {
  // The running sprint uses the accent colour; earlier sprints are amber, so the two are never confused.
  current: { chip: "border-accent/40 bg-accent-soft text-accent", dot: "bg-accent" },
  previous: { chip: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
};

type Bucket = { key: string; tone: Tone; sprint: Sprint; task: BacklogItemData; entries: WorkEntry[] };

/** The tasks this one was copied from, nearest first (a task carried over twice has two). */
export function carriedChain(task: BacklogItemData, all: readonly BacklogItemData[]): BacklogItemData[] {
  const chain: BacklogItemData[] = [];
  let current: BacklogItemData | undefined = task;
  for (let i = 0; i < 10 && current?.carriedFrom; i += 1) {
    const from: string = current.carriedFrom;
    current = all.find((t) => t.id === from);
    if (current) chain.push(current);
  }
  return chain;
}

const sum = (list: readonly WorkEntry[]) => list.reduce((total, e) => total + e.hours, 0);

function Chip({ bucket, person }: { bucket: Bucket; person: string }) {
  const { tone, sprint, task, entries } = bucket;
  const total = sum(entries);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  // The details card is a top-layer popover (not clipped by the scrolling task list or the card around it). It opens at the chip's right
  // side, or its left when there is no room, and never leaves the window: near the bottom it moves up, on a narrow screen it goes above or below.
  useEffect(() => {
    const el = tip.current;
    const anchor = wrap.current;
    if (!el || !anchor || typeof el.showPopover !== "function") return;
    if (!open) {
      if (el.matches(":popover-open")) el.hidePopover();
      return;
    }
    el.showPopover();
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 8;
    const fitsRight = r.right + gap + w <= window.innerWidth - gap;
    const fitsLeft = r.left - gap - w >= gap;
    let left: number;
    let top: number;
    if (fitsRight || fitsLeft) {
      left = fitsRight ? r.right + gap : r.left - gap - w;
      top = Math.min(Math.max(gap, r.top), window.innerHeight - h - gap);
    } else {
      left = Math.min(Math.max(gap, r.left), window.innerWidth - w - gap);
      top = r.top - h - gap >= gap ? r.top - h - gap : Math.min(r.bottom + gap, Math.max(gap, window.innerHeight - h - gap));
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    const hide = () => setOpen(false);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  return (
    <span
      ref={wrap}
      className="relative inline-block"
      tabIndex={0}
      aria-describedby={id}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && open && setOpen(false)}
    >
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[tone].chip}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${TONE[tone].dot}`} aria-hidden="true" />
        {sprintLabel(sprint.name)} {tone === "current" ? "(current)" : "(previous)"} · {formatHours(total)}
      </span>
      <span
        ref={tip}
        id={id}
        role="tooltip"
        popover="manual"
        className="pointer-events-none m-0 max-h-[calc(100dvh-1rem)] w-72 max-w-[calc(100vw-1rem)] overflow-auto rounded-xl border border-border bg-surface p-3 text-xs text-foreground shadow-menu"
        style={{ position: "fixed", inset: "auto" }}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <span className={`h-2 w-2 rounded-full ${TONE[tone].dot}`} aria-hidden="true" />
          {sprintLabel(sprint.name)}
          <span className="text-xs font-normal text-muted">{tone === "current" ? "current sprint" : "previous sprint"}</span>
        </span>
        <span className="mt-1.5 block">
          <span className="text-muted">Task</span> {task.title}
        </span>
        <span className="block">
          <span className="text-muted">User</span> {person}
        </span>
        {entries.length === 0 ? (
          <span className="mt-1.5 block text-muted">No hours logged in {sprintLabel(sprint.name)}.</span>
        ) : (
          <span className="mt-1.5 block divide-y divide-border rounded-lg border border-border">
            {entries.map((e) => (
              <span key={e.id} className="flex justify-between gap-3 px-2 py-1 tabular-nums">
                <span>
                  {formatDay(e.from)}
                  {e.to !== e.from && ` – ${formatDay(e.to)}`}
                </span>
                <span className="font-medium">{formatHours(e.hours)}</span>
              </span>
            ))}
          </span>
        )}
        <span className="mt-1.5 flex justify-between font-semibold">
          <span>Total in {sprintLabel(sprint.name)}</span>
          <span className="tabular-nums">{formatHours(total)}</span>
        </span>
      </span>
    </span>
  );
}

type TaskSprintHoursProps = {
  task: BacklogItemData;
  /** The running sprint the task is listed under. */
  sprint: Sprint;
  person: string;
  /** This person's time entries, in every sprint. */
  entries: readonly WorkEntry[];
  /** Every task, hidden ones included, so the chain back to the original can be followed. */
  allTasks: readonly BacklogItemData[];
  allSprints: readonly Sprint[];
};

/**
 * Shown under a ticked task: the hours logged in this (current) sprint and, for a task carried over from an earlier
 * sprint, the hours logged there. Each sprint's hours stay separate; hovering a chip lists its entries and total.
 */
export default function TaskSprintHours({ task, sprint, person, entries, allTasks, allSprints }: TaskSprintHoursProps) {
  const covering = (sprintId: string, taskId: string) => entries.filter((e) => e.sprintId === sprintId && e.itemIds?.includes(taskId));

  const buckets: Bucket[] = [{ key: `${task.id}-current`, tone: "current", sprint, task, entries: covering(sprint.id, task.id) }];
  for (const original of carriedChain(task, allTasks)) {
    const earlier = allSprints.find((s) => s.name === original.sprint);
    if (earlier) buckets.push({ key: `${original.id}-previous`, tone: "previous", sprint: earlier, task: original, entries: covering(earlier.id, original.id) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pl-11">
      {buckets.map((b) => (
        <Chip key={b.key} bucket={b} person={person} />
      ))}
    </div>
  );
}
