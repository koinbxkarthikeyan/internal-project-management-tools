"use client";

import { useMemo } from "react";
import { useToast } from "@/components/ui/Toast";
import { sprintLabel } from "@/constants/backlog-options";
import type { BacklogItemData } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import { canReceive, orderedSections } from "../sprintMoves";
import { placementToItem } from "../components/TaskPlacementFields";

/**
 * Moving a task between sprint sections (drag-and-drop, after a confirmation; the arrows only reorder inside one list). The task is saved through the app's existing task update
 * (the one the Edit panel uses): the task changes on screen only after the server accepts it, a refused move shows the server's message and leaves the
 * task where it was, and "moved" is reported only for a move that was saved. This is the one place to change when a dedicated ordering API exists.
 */
export function useSprintMoves() {
  const { sprints, updateItem } = useBacklog();
  const toast = useToast();
  const sections = useMemo(() => orderedSections(sprints), [sprints]);

  /** Can this task be moved at all? Not once it is completed, and not out of a closed sprint. */
  const movable = (item: BacklogItemData) => item.status !== "Completed" && !item.readOnly && sections.includes(item.sprint);
  const canDrop = (item: BacklogItemData, section: string) => movable(item) && item.sprint !== section && canReceive(sprints, section);

  async function move(item: BacklogItemData, section: string): Promise<boolean> {
    if (!canReceive(sprints, section)) {
      toast.show("A task can't be moved into a closed sprint.", "danger");
      return false;
    }
    if (!movable(item) || item.sprint === section) return false;
    const saved = await updateItem(item.id, placementToItem(section === "Unplanned" ? { kind: "unplanned", choice: "" } : { kind: "sprint", choice: section }, item));
    if (saved) toast.show(`${item.title} moved to ${sprintLabel(section)}`);
    return saved; // when it was refused, updateItem has already said why
  }

  return { canDrop, move };
}
