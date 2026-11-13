"use client";

import { useCallback } from "react";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { offDaysOf, useLeaveStore } from "@/stores/leaveStore";

/** A function giving a sprint's 0-hour dates for one person (the sprint's common leave + their own); it changes whenever either changes, so screens recalculate. */
export function useOffFor(userId?: string) {
  const { sprints } = useBacklog();
  const personal = useLeaveStore((s) => s.personal);
  return useCallback((sprintId: string) => offDaysOf(sprints.find((s) => s.id === sprintId)?.commonLeaves ?? [], personal, sprintId, userId), [sprints, personal, userId]);
}

/** Same, for any person by id (the Team Work Details lists everyone; only the signed-in person's own leave is known to this browser). */
export function useOffForPerson() {
  const { sprints } = useBacklog();
  const personal = useLeaveStore((s) => s.personal);
  return useCallback((userId?: string) => (sprintId: string) => offDaysOf(sprints.find((s) => s.id === sprintId)?.commonLeaves ?? [], personal, sprintId, userId), [sprints, personal]);
}
