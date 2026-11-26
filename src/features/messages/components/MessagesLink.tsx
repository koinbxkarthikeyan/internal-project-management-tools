"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import RailTip from "@/components/ui/RailTip";
import { MailIcon } from "@/components/ui/icons";
import { MESSAGES_HREF, MESSAGES_LABEL } from "@/constants/work";
import { useToast } from "@/components/ui/Toast";
import { playPing } from "@/features/notifications/ping";
import { useNotificationStore } from "@/features/notifications/store";
import { useUsers } from "@/features/users/hooks/useUsers";
import { onExternalChange } from "@/lib/localApi";
import * as chat from "@/services/messageService";

/** The sidebar link to Messages, above the menus (everyone has it, whatever their role), with the number of messages not read yet. */
export default function MessagesLink() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const active = pathname === MESSAGES_HREF || pathname.startsWith(`${MESSAGES_HREF}/`);
  const toast = useToast();
  const users = useUsers();
  // The latest values for the reader below, which is set up once.
  const here = useRef({ active, users, toast });
  useEffect(() => {
    here.current = { active, users, toast };
  });
  // How many unread messages each direct chat had when last looked at (null until the first read, so what was already waiting is not announced).
  const seen = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    const read = () =>
      chat.getOverview().then((o) => {
        setUnread(o.pods.reduce((n, p) => n + p.unread, 0) + Object.values(o.dms).reduce((n, d) => n + d.unread, 0));
        // A new direct message: the bell rings, the chime plays and its list is read again; away from Work Chat there is also a notice with who and what.
        const before = seen.current;
        seen.current = Object.fromEntries(Object.entries(o.dms).map(([id, d]) => [id, d.unread]));
        if (!before) return;
        for (const [id, d] of Object.entries(o.dms)) {
          if (d.unread > (before[id] ?? 0) && d.last) {
            const name = here.current.users.find((u) => u.id === id)?.name ?? "Someone";
            // The notice is for when Work Chat is not open; on its page the unread count in the list says it. The bell and the chime are for both.
            if (!here.current.active) here.current.toast.show(`${name}: ${chat.previewOf(d.last).length > 80 ? `${chat.previewOf(d.last).slice(0, 80)}…` : chat.previewOf(d.last)}`, "info", 6000);
            // The bell is told at once too (it rings, the chime plays, and its list and count are read again), without waiting for its own refresh.
            playPing();
            window.dispatchEvent(new Event("notification-arrived"));
            useNotificationStore.getState().reload();
            break;
          }
        }
      }, () => undefined);
    const first = setTimeout(() => void read(), 0);
    const off = onExternalChange(() => void read());
    return () => (clearTimeout(first), off());
  }, []);

  const label = unread > 0 ? `${MESSAGES_LABEL}, ${unread} unread` : MESSAGES_LABEL;
  return (
    <RailTip label={MESSAGES_LABEL}>
      <Link
        href={MESSAGES_HREF}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={`sb-item group relative flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${active ? "bg-accent-soft font-medium text-accent" : "bg-background/60 hover:bg-hover"}`}
      >
        <MailIcon className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
        <span className="sb-label flex-1 truncate">{MESSAGES_LABEL}</span>
        {unread > 0 && <span className="sb-label rounded-full bg-accent px-2 py-0.5 text-xs font-semibold tabular-nums text-accent-foreground">{unread > 99 ? "99+" : unread}</span>}
      </Link>
    </RailTip>
  );
}
