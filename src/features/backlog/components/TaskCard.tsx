"use client";

import { useState } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";
import { PriorityBadge } from "@/components/ui/Badge";
import type { Priority } from "@/types/backlog";
import { PRIORITY_CARD } from "../priorityCard";
import TaskCardBadges from "./TaskCardBadges";

/**
 * The one card every board uses (My Task, QA Workspace, a task's Tickets): the title with, at the top right, the Ticket count and, as a separate element, the unread
 * notifications; the id and priority; the card's own details; and a footer line. Its colours follow the priority (also while it flashes for unread notifications), and every
 * card has the same size. `edge` is the thin left bar for "assigned to you" (accent) or "has a Ticket for you" (amber).
 */
export default function TaskCard({ title, code, priority, tickets, unread, onBell, badges, edge, onOpen, className = "", ariaLabel, hint, tall = false, children, footer, more }: { title: string; code: string; priority: Priority; /** The Ticket count; left out for a Ticket (it has none). */ tickets?: number; unread: number; /** Opens the latest unread notice about the card (marking it read). */ onBell?: () => void; /** Extra badges after the priority (Reopened, Blocked...). */ badges?: React.ReactNode; edge?: "accent" | "amber" | null; onOpen?: () => void; className?: string; ariaLabel?: string; hint?: string; /** A taller card, for one with long detail lines (My Task: the ETA lines carry their full form). */ tall?: boolean; /** The card's details, one line each. */ children?: React.ReactNode; footer?: React.ReactNode; /** Shown inside the card when its arrow (beside the title) is opened; the card then grows to fit it. Left out, there is no arrow. */ more?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={ariaLabel}
      title={hint}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), onOpen()) : undefined}
      className={`${unread > 0 ? "card-flash " : ""}flex ${open ? "h-auto" : tall ? "h-[12rem]" : "h-[10.5rem]"} w-full flex-col gap-1.5 overflow-hidden rounded-xl border p-2.5 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${PRIORITY_CARD[priority]} ${edge === "amber" ? "shadow-[inset_3px_0_0_0_var(--color-amber-500)]" : edge === "accent" ? "shadow-[inset_3px_0_0_0_var(--accent)]" : ""} ${onOpen ? "cursor-pointer hover:brightness-[.97] dark:hover:brightness-110" : ""} ${className}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-1">
          <span className="line-clamp-2 min-h-10 min-w-0 break-words text-sm font-medium" title={title}>{title}</span>
          {more && (
            <button
              type="button"
              onClick={(e) => (e.stopPropagation(), setOpen((o) => !o))}
              aria-expanded={open}
              aria-label={open ? "Hide Tickets and comments" : "Show Tickets and comments"}
              title={open ? "Hide Tickets and comments" : "Tickets and comments"}
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border bg-hover text-foreground transition-colors hover:bg-border focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronRightIcon width={12} height={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
            </button>
          )}
        </span>
        <TaskCardBadges tickets={tickets} unread={unread} onBell={onBell} />
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted">{code}</span>
        <PriorityBadge priority={priority} />
        {badges}
      </span>
      <span className="flex flex-col gap-0.5 text-[11px] text-muted">{children}</span>
      {open && more}
      {footer && <span className="mt-auto flex items-center justify-between gap-2 text-[11px] text-muted">{footer}</span>}
    </div>
  );
}
