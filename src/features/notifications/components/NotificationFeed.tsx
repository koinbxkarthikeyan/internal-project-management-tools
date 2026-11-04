"use client";

import { useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { onExternalChange } from "@/lib/localApi";
import { useMyTasksStore } from "@/stores/myTasksStore";
import { startNotificationTransport } from "..";
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
    return () => {
      clearTimeout(timer);
      stopWatch();
      stopTransport();
      stopList();
    };
  }, [userId]);
  return null;
}
