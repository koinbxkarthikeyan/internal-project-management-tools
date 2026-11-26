"use client";

import { useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { onExternalChange } from "@/lib/localApi";
import { useMyTasksStore } from "@/stores/myTasksStore";
import { startNotificationTransport } from "..";
import { playPing, unlockPing } from "../ping";
import { useNotificationStore } from "../store";

/** Starts following the signed-in person's notifications once for the whole app (the bells only read the store). Renders nothing. */
export default function NotificationFeed() {
  const { user, settingsOnly } = useAuth();
  const userId = user && !settingsOnly ? user.id : "";
  // One feed for the whole app: it follows this person's list and re-reads it when another tab of this browser changes the data.
  useEffect(() => {
    if (!userId) return;
    const stopList = useNotificationStore.getState().start(userId);
    // The Tickets assigned to this person (for the count in the bell): read now, and again when another tab of this browser changes the data.
    void useMyTasksStore.getState().load(userId);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopWatch = onExternalChange(() => {
      clearTimeout(timer);
      timer = setTimeout(() => void useMyTasksStore.getState().load(userId, true), 300);
    });
    const stopTransport = startNotificationTransport(userId);
    // Every new unread notification (one not seen in the list before) chimes and rings the bell. What was already there when the list first loaded does not.
    const unlock = unlockPing();
    let known: Set<string> | null = null;
    const stopRing = useNotificationStore.subscribe((st) => {
      if (st.userId !== userId || st.loading) return;
      const ids = new Set(st.items.map((n) => n.id));
      if (known === null) {
        known = ids;
        return;
      }
      const fresh = st.items.some((n) => !n.read && !known!.has(n.id));
      known = new Set([...known, ...ids]);
      if (fresh) {
        playPing();
        window.dispatchEvent(new Event("notification-arrived"));
      }
    });
    return () => {
      stopRing();
      unlock();
      clearTimeout(timer);
      stopWatch();
      stopTransport();
      stopList();
    };
  }, [userId]);
  return null;
}
