"use client";

import { useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { startNotificationTransport } from "..";
import { useNotificationStore } from "../store";

/** Starts following the signed-in person's notifications once for the whole app (the bells only read the store). Renders nothing. */
export default function NotificationFeed() {
  const { user, settingsOnly } = useAuth();
  const userId = user && !settingsOnly ? user.id : "";
  // One feed for the whole app: it follows this person's list and, in WebSocket mode, keeps the single shared socket open for them.
  useEffect(() => {
    if (!userId) return;
    const stopList = useNotificationStore.getState().start(userId);
    const stopTransport = startNotificationTransport(userId);
    return () => {
      stopTransport();
      stopList();
    };
  }, [userId]);
  return null;
}
