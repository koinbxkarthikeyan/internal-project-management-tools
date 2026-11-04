export type Priority = "Critical" | "High" | "Medium" | "Low" | "Not set";
export type ItemType = "Feature" | "Enhancement" | "Task" | "Bug" | "Ticket" | "Tech Debt";
export type Status = "Open" | "In progress" | "Blocked" | "Ready for QA" | "Testing" | "On hold" | "Done";

/** A reopen of a completed task or Ticket, kept whole in its history. */
export type ReopenRecord = { kind: "Task" | "Ticket"; by: string; byId: string; at: string; from: Status; to: Status; comment?: string };

export type ActivityEntry = {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** The full timestamp from the backend (ISO 8601 with a time), when it sent one. */
  at?: string;
  text: string;
  /** Who did it, as the backend names them (never filled in by the app). */
  by?: string;
  /** Set on a reopen entry: who reopened it, when, from which status to which, and why. */
  reopen?: ReopenRecord;
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
  /** From the backend's task detail: the signed-in user may change status, assignees and Developer ETA. */
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
  /** The code of the task this one sits under: a Bug under a top-level task, a Ticket under a Bug. Absent for a top-level task. */
  parent?: string;
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
  /** User ids of the Lead and of the Assigned Users (from the backend), used to decide whose task this is. */
  leadId?: string;
  assigneeIds?: string[];
  /** ISO date (YYYY-MM-DD) set by the Lead. Separate from `deadline` (the expected deadline), which it never changes. */
  leadDeadline?: string;
  /** ISO date (YYYY-MM-DD) the task last entered Ready for QA, recorded by the app. */
  readyForQaDate?: string;
  /** Id of the task this one was copied from when its sprint closed unfinished (the original stays in the old sprint). */
  carriedFrom?: string;
  /** The ids of every sprint this task has belonged to, in order (`null` is Backlog), the current one last (the backend's `history.sprintIds`). Absent until the backend sends it. */
  historySprintIds?: (string | null)[];
  blockedReason?: string;
  /** ISO date (YYYY-MM-DD). */
  created?: string;
  /** Full timestamps from the backend, when it sent them (the date-only `created` is kept for the screens that use it). */
  createdAt?: string;
  updatedAt?: string;
  /** Who created and last updated the task, when the backend says. */
  createdBy?: string;
  /** The creating user's id, and their team as it was when they created it (never the assigned team). */
  createdById?: string;
  createdByTeam?: string;
  /** The team the assignee is in now (a Ticket's Assigned Team), separate from the creator's team. */
  assignedTeam?: string;
  updatedBy?: string;
  /** ISO date (YYYY-MM-DD), or empty when not completed. */
  completed?: string;
  /** ISO date (YYYY-MM-DD) a completed task was last reopened; `completed` is kept as the last completion. */
  reopenedAt?: string;
  /** The status the task had before it was completed: where Reopen puts it back. */
  completedFrom?: Status;
  activity?: ActivityEntry[];
  /** On the Ready for QA list: how many Tickets the task has and how many are Done. */
  ticketStats?: { total: number; done: number; /** The codes of those Tickets. */ codes: string[] };
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
