import { create } from "zustand";

type WorkPick = {
  picked: string[] | null;
  setPicked: (ids: string[] | null) => void;
  /** An Admin's choice to list every closed sprint (otherwise only the latest one). */
  showAllClosed: boolean;
  setShowAllClosed: (on: boolean) => void;
};

/**
 * Which sprints the Log Work and Your Logged Work pages show. It is shared, so both pages follow the same sprint when you move between them;
 * `null` means "the running sprint (else the latest)" until one is picked. Cleared when signing out.
 */
export const useWorkPickStore = create<WorkPick>((set) => ({
  picked: null,
  setPicked: (picked) => set({ picked }),
  showAllClosed: false,
  setShowAllClosed: (showAllClosed) => set({ showAllClosed }),
}));
