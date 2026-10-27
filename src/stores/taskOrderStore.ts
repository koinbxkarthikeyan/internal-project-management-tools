import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Where tasks sit inside each list (a sprint, or the Backlog), kept only in this browser: the backend has no field for a task's place in a list, so nothing
 * is sent to it and the order is not shared with other people or devices. Only task ids are stored, under the signed-in person's id.
 */
type TaskOrderState = {
  /** user id -> list name ("Unplanned" for the Backlog) -> task ids in order */
  orders: Record<string, Record<string, string[]>>;
  setOrder: (userId: string, list: string, ids: string[]) => void;
};

export const useTaskOrderStore = create<TaskOrderState>()(
  persist(
    (set) => ({
      orders: {},
      setOrder: (userId, list, ids) => set((s) => ({ orders: { ...s.orders, [userId]: { ...s.orders[userId], [list]: ids } } })),
    }),
    { name: "koinbx.task-order.v1" },
  ),
);
