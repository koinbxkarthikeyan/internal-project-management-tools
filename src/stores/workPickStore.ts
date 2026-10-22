import { create } from "zustand";

/**
 * Which sprints the Log Work and Your Logged Work pages show. It is shared, so both pages follow the same sprint when you move between them;
 * `null` means "the running sprint (else the latest)" until one is picked. Cleared when signing out.
 */
export const useWorkPickStore = create<{ picked: string[] | null; setPicked: (ids: string[] | null) => void }>((set) => ({
  picked: null,
  setPicked: (picked) => set({ picked }),
}));
