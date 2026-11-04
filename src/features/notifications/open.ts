"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { MY_TASK_HREF, READY_FOR_QA_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useNotificationStore } from "./store";
import type { AppNotification } from "./types";

/** Where a notification leads: straight to the task, Bug or Ticket it is about (by its id, so it works from any page and whoever the item is assigned to), at its comment when it is about one. The QA team and the admins use the QA Workspace pages, everyone else My Task. */
export function notificationHref(n: AppNotification, qa: boolean): string {
  const area = qa ? READY_FOR_QA_HREF : MY_TASK_HREF;
  const comment = n.commentId ? `&comment=${encodeURIComponent(n.commentId)}` : "";
  if (!n.taskId) return `${MY_TASK_HREF}?task=${encodeURIComponent(n.taskCode)}${comment}`;
  return `${area}/${/^TKT-/i.test(n.taskCode) ? "ticket" : "task"}?id=${encodeURIComponent(n.taskId)}${comment}`;
}

/** The one way to open a notification (the bell, its panel, a task card's bell): it is marked read now, because it was clicked and opened, and the item opens. Reading it takes it out of the unread list and count at once; it stays in the history. */
export function useOpenNotification() {
  const router = useRouter();
  const { isQa, isAdmin } = useAuth();
  return useCallback(
    (n: AppNotification) => {
      useNotificationStore.getState().markRead(n.id);
      router.push(notificationHref(n, isQa || isAdmin));
    },
    [router, isQa, isAdmin],
  );
}
