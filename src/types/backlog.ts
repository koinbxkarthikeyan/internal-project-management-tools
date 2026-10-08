export type Priority = "Critical" | "High" | "Medium" | "Low" | "Not set";
export type ItemType = "Feature" | "Enhancement" | "Task" | "Bug" | "Tech Debt";
export type Status = "Open" | "In progress" | "Blocked" | "On hold" | "Completed";

export type ActivityEntry = {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  text: string;
};

/** A sprint is running (Active) until it is closed. Only one sprint can be Active at a time. A sprint that follows an early close waits as Paused until someone starts it. */
export type SprintStatus = "Active" | "Paused" | "Closed";

export type Sprint = {
  id: string;
  name: string;
  /** ISO dates (YYYY-MM-DD); absent for "Unplanned". */
  start?: string;
  end?: string;
  goal?: string;
  /** The PODs selected for this sprint (ids). A sprint can have many; a task belongs to one of them. */
  podIds?: string[];
  /** Absent only for the built-in "Unplanned" sprint. */
  status?: SprintStatus;
  /** When it was closed (ISO time), set by the server; used to announce the closing once. */
  closedAt?: string;
};

export type BacklogItemData = {
  /** The task code shown everywhere (e.g. BLG-7). The backend's numeric id is `apiId`. */
  id: string;
  /** The backend's numeric id, used in API calls. */
  apiId?: number;
  /** From the backend's task detail: the signed-in user may change status, assignees and Lead Deadline. */
  canLeadEdit?: boolean;
  /** From the backend's task detail: the task is read-only (it belongs to a closed sprint). */
  readOnly?: boolean;
  title: string;
  priority: Priority;
  /** What kind of work it is. Absent on older tasks. */
  type?: ItemType;
  status: Status;
  owner: string;
  sprint: string;
  /** The POD (id) this task belongs to; one of the PODs selected for its sprint. */
  podId?: string;
  comments: number;
  /** ISO date (YYYY-MM-DD), or empty when not set. */
  deadline: string;
  /** UI-only flag: item is moved to the "Hidden" view. */
  hidden?: boolean;
  description?: string;
  notes?: string;
  /** Comma-separated names. */
  assignees?: string;
  /** The one registered user (by name) who leads this task. */
  lead?: string;
  /** ISO date (YYYY-MM-DD) set by the Lead. Separate from `deadline` (the expected deadline), which it never changes. */
  leadDeadline?: string;
  /** Id of the task this one was copied from when its sprint closed unfinished (the original stays in the old sprint). */
  carriedFrom?: string;
  blockedReason?: string;
  /** ISO date (YYYY-MM-DD). */
  created?: string;
  /** ISO date (YYYY-MM-DD), or empty when not completed. */
  completed?: string;
  activity?: ActivityEntry[];
};

/** An owner as stored by the API. Items reference owners by `name`. */
export type Owner = {
  id: string;
  name: string;
  /** Role / position, free text (e.g. "Developer – Backend"); used to group people in dropdowns. */
  role?: string;
  /** Team the person belongs to, free text. */
  team?: string;
};

export type NewItemInput = Omit<BacklogItemData, "id">;
export type ItemPatch = Partial<Omit<BacklogItemData, "id">>;
export type SprintInput = Omit<Sprint, "id">;
export type OwnerInput = Pick<Owner, "name" | "role" | "team">;
/** On update, an empty string clears the role or team; undefined keeps it. */
export type OwnerUpdate = { name: string; role?: string; team?: string };
