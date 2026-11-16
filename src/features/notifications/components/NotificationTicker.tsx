"use client";

import { useRouter } from "next/navigation";
import { BellIcon } from "@/components/ui/icons";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { MY_TASK_HREF } from "@/constants/work";
import { describe, timeAgo } from "../describe";
import { selectUnread, useNotificationStore } from "../store";
import type { AppNotification } from "../types";

/** A slim strip above every page that scrolls the unread notifications along; it is not there when nothing is unread. */
export default function NotificationTicker() {
  const { settingsOnly } = useAuth();
  const router = useRouter();
  const items = useNotificationStore((s) => s.items);
  const unread = useNotificationStore(selectUnread);
  const list = items.filter((n) => !n.read);
  if (settingsOnly || unread === 0 || list.length === 0) return null;

  const open = (n: AppNotification) => {
    useNotificationStore.getState().markRead(n.id);
    router.push(`${MY_TASK_HREF}?task=${encodeURIComponent(n.taskCode)}`);
  };
  // The list is shown twice in a row so the loop has no gap; the second copy is hidden from assistive tech.
  const row = (copy: number) =>
    list.map((n) => (
      <button
        key={`${copy}-${n.id}`}
        type="button"
        tabIndex={copy ? -1 : 0}
        aria-hidden={copy ? true : undefined}
        onClick={() => open(n)}
        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="font-medium">{n.actor.name}</span>
        <span className="text-muted">{describe(n)}</span>
        <span className="font-medium text-accent">{n.taskCode}</span>
        <span className="text-xs text-muted">· {timeAgo(n.occurredAt)}</span>
      </button>
    ));

  return (
    <section aria-label="Unread notifications" className="mb-3 flex h-9 items-center overflow-hidden rounded-xl border border-border bg-surface">
      <span className="flex h-full shrink-0 items-center gap-1.5 border-r border-border px-3 text-xs font-medium text-accent">
        <BellIcon />
        {unread} unread
      </span>
      <div className="ticker-mask min-w-0 flex-1 overflow-hidden">
        <div className="ticker-track flex w-max items-center" style={{ animationDuration: `${Math.max(20, list.length * 12)}s` }}>
          {row(0)}
          {row(1)}
        </div>
      </div>
    </section>
  );
}
