"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import { BellIcon } from "@/components/ui/icons";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { MY_TASK_HREF } from "@/constants/work";
import { useNotificationConnection, type ConnectionStatus } from "../connection";
import { EVENT_LABEL, describe, timeAgo } from "../describe";
import { selectUnread, useNotificationStore } from "../store";
import type { AppNotification } from "../types";

const WIDTH = 384;
const STATUS_TEXT: Record<ConnectionStatus, string> = {
  unconfigured: "Live updates aren't set up · refreshes every minute",
  connecting: "Connecting to the notification server…",
  connected: "Live · connected to the notification server",
  reconnecting: "Connection lost · reconnecting…",
  disconnected: "Not connected to the notification server · refreshes every minute",
  error: "Connection problem · retrying",
};

/** Where notifications come from, and whether the connection is up. */
function ConnectionLine() {
  const status = useNotificationConnection((s) => s.status);
  const detail = useNotificationConnection((s) => s.detail);
  const tone = status === "connected" ? "bg-emerald-500" : status === "unconfigured" ? "bg-slate-400" : status === "connecting" || status === "reconnecting" ? "bg-amber-500" : "bg-red-500";
  return (
    <p className="flex items-center gap-1.5 border-b border-border px-4 py-1.5 text-[11px] text-muted" role="status" data-notification-status={status}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} aria-hidden="true" />
      {STATUS_TEXT[status]}
      {detail && status !== "connected" && <span className="truncate text-red-600 dark:text-red-300" title={detail}> · {detail}</span>}
    </p>
  );
}

/** The bell in the header: unread count, and a panel with the list, Mark read and Mark all as read. Clicking one opens its task. */
export default function NotificationBell() {
  const { user, settingsOnly } = useAuth();
  const router = useRouter();
  const allItems = useNotificationStore((s) => s.items);
  const filter = useNotificationStore((s) => s.filter);
  const hasMore = useNotificationStore((s) => s.hasMore);
  const loading = useNotificationStore((s) => s.loading);
  const error = useNotificationStore((s) => s.error);
  // The server filters by itself; this keeps the list right while a change is still arriving.
  const items = filter === "unread" ? allItems.filter((n) => !n.read) : allItems;
  const unread = useNotificationStore(selectUnread);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: WIDTH });
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && button.current) {
      const r = button.current.getBoundingClientRect();
      const width = Math.min(WIDTH, window.innerWidth - 16);
      setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(false), button.current?.focus());
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!user || settingsOnly) return null;

  function openTask(n: AppNotification) {
    useNotificationStore.getState().markRead(n.id);
    setOpen(false);
    router.push(`${MY_TASK_HREF}?task=${encodeURIComponent(n.taskCode)}`);
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold tabular-nums text-white" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Notifications"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="anim-fade-up fixed z-[60] flex max-h-[min(34rem,calc(100vh-5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-menu"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">
                Notifications {unread > 0 && <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{unread} new</span>}
              </h2>
              <button
                type="button"
                disabled={unread === 0}
                onClick={() => useNotificationStore.getState().markAllRead()}
                className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-hover disabled:cursor-not-allowed disabled:text-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
              >
                Mark all as read
              </button>
            </div>
            <ConnectionLine />
            <div role="group" aria-label="Show notifications" className="flex gap-1 border-b border-border px-3 py-1.5">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => useNotificationStore.getState().setFilter(f)}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${filter === f ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"}`}
                >
                  {f === "all" ? "All" : "Unread"}
                </button>
              ))}
            </div>
            {items.length === 0 ? (
              loading ? (
                <p className="px-4 py-6 text-center text-xs text-muted" role="status">Loading…</p>
              ) : error ? (
                <div role="alert" className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                  <p className="text-sm font-medium">Couldn&apos;t load notifications</p>
                  <p className="text-xs text-muted">Check your connection and try again.</p>
                  <button type="button" onClick={() => useNotificationStore.getState().reload()} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
                    Try again
                  </button>
                </div>
              ) : (
                <EmptyState compact title={filter === "unread" ? "No unread notifications" : "No notifications yet"} description={filter === "unread" ? "You are all caught up." : "You will be told when a task is assigned to you or changes."} />
              )
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id} className={`flex items-start gap-2 px-3 py-2.5 ${n.read ? "" : "bg-accent-soft/50"}`}>
                    <button
                      type="button"
                      onClick={() => openTask(n)}
                      className="flex min-w-0 flex-1 items-start gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} aria-label={n.read ? undefined : "Unread"} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${n.read ? "font-medium" : "font-semibold"}`}>
                            {n.taskCode} · {n.taskTitle}
                          </span>
                          <span className="shrink-0 rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-muted">{EVENT_LABEL[n.type]}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {n.message ? n.message : <><span className="font-medium text-foreground">{n.actor.name}</span> {describe(n)}</>}
                        </span>
                        <time dateTime={n.occurredAt} title={new Date(n.occurredAt).toLocaleString()} className="mt-0.5 block text-[11px] text-muted">
                          {timeAgo(n.occurredAt)}
                        </time>
                      </span>
                    </button>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => useNotificationStore.getState().markRead(n.id)}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        Mark read
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {hasMore && (
              <button
                type="button"
                disabled={loading}
                onClick={() => useNotificationStore.getState().loadMore()}
                className="shrink-0 border-t border-border px-4 py-2 text-xs font-medium text-accent hover:bg-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-accent"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
