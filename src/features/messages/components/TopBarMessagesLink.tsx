"use client";

import { ChatIcon } from "@/components/ui/icons";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MESSAGES_HREF, MESSAGES_LABEL } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { onExternalChange } from "@/lib/localApi";
import { getOverview } from "@/services/messageService";

/** The phone top bar's Work Chat link, beside the notification bell: a chat icon with the number of unread messages. Hidden for accounts with no access to Messages. */
export default function TopBarMessagesLink() {
  const { settingsOnly } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (settingsOnly) return;
    const read = () =>
      getOverview().then(
        (o) => setUnread(o.pods.reduce((n, p) => n + p.unread, 0) + Object.values(o.dms).reduce((n, d) => n + d.unread, 0)),
        () => undefined,
      );
    const first = setTimeout(() => void read(), 0);
    const off = onExternalChange(() => void read());
    return () => (clearTimeout(first), off());
  }, [settingsOnly]);
  if (settingsOnly) return null;
  return (
    <Link href={MESSAGES_HREF} aria-label={unread ? `${MESSAGES_LABEL}, ${unread} unread` : MESSAGES_LABEL} title={MESSAGES_LABEL} className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
      <ChatIcon width={18} height={18} />
      {unread > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 tabular-nums text-accent-foreground">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
