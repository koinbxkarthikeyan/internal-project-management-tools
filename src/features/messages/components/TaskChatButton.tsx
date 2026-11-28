"use client";

import { ChatIcon } from "@/components/ui/icons";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MESSAGES_HREF, MESSAGES_LABEL } from "@/constants/work";
import { onExternalChange } from "@/lib/localApi";
import { getOverview } from "@/services/messageService";

/** On a task's page: a button to its chat (the Work Chat of its POD), with the number of unread messages. It is shown only to the people who are in that chat. */
export default function TaskChatButton({ taskId }: { taskId: number }) {
  const [unread, setUnread] = useState<number | null>(null); // null: not in this chat (or not read yet)
  useEffect(() => {
    const read = () =>
      getOverview().then(
        (o) => {
          const p = o.pods.find((x) => x.taskId === taskId);
          setUnread(p ? p.unread + o.pods.filter((t) => t.parentId === taskId).reduce((n, t) => n + t.unread, 0) : null);
        },
        () => undefined,
      );
    const first = setTimeout(() => void read(), 0);
    const off = onExternalChange(() => void read());
    return () => (clearTimeout(first), off());
  }, [taskId]);
  if (unread === null) return null;
  return (
    <Link href={`${MESSAGES_HREF}?open=task:${taskId}`} title={MESSAGES_LABEL} className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-2.5 text-xs sm:px-3 font-semibold transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
      <ChatIcon width={14} height={14} />
      <span className="sr-only sm:not-sr-only">{MESSAGES_LABEL}</span>
      {unread > 0 && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-accent-foreground">{unread}</span>}
    </Link>
  );
}
