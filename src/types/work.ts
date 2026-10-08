export type WorkKind = "Backend" | "Frontend" | "Mobile" | "Testing" | "Design";

/** A block of work someone logged against a sprint. */
export type WorkEntry = {
  id: string;
  sprintId: string;
  /** Owner name of the person who logged it. */
  person: string;
  /** POD name when logged (kept for display). */
  pod: string;
  podId?: string;
  kind: WorkKind;
  /** Titles of the tasks worked on, joined for display. */
  task: string;
  /** The backlog tasks this time was logged against. */
  itemIds?: string[];
  /** ISO dates (YYYY-MM-DD), inclusive. */
  from: string;
  to: string;
  hours: number;
  notes?: string;
  createdAt: string;
};

export type WorkEntryInput = Omit<WorkEntry, "id" | "createdAt">;
export type WorkEntryPatch = Partial<WorkEntryInput>;

export type Pod = {
  id: string;
  name: string;
  /** Hidden PODs are kept (with their tasks and logged time) but left out of every list and choice. */
  hidden?: boolean;
};

export type PodInput = Pick<Pod, "name">;
export type PodPatch = Partial<Pick<Pod, "name" | "hidden">>;
