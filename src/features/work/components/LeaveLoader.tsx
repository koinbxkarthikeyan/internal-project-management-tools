"use client";

import { useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { useLeaveStore } from "@/stores/leaveStore";

/** Reads the signed-in person's leave days from the backend, for every sprint that has dates, so every expected-hours figure can use them. It renders nothing. */
export default function LeaveLoader() {
  const { user, settingsOnly } = useAuth();
  const { sprints } = useBacklog();
  const me = user?.id ?? "";
  const key = sprints.filter((s) => s.name !== "Unplanned" && s.start && s.end).map((s) => s.id).join(",");
  useEffect(() => {
    if (!me || settingsOnly) return useLeaveStore.getState().clear();
    if (key) void useLeaveStore.getState().load(key.split(","), me);
  }, [me, settingsOnly, key]);
  return null;
}
