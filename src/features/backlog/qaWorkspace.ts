import type { BacklogItemData } from "@/types/backlog";

/** The QA statuses, in flow order. Every role sees the same three, with the same names. `drop` is what a task dropped on the column becomes (Ready for QA is only entered by a hand-over). */
export const QA_COLUMNS = [
  { status: "Ready for QA", title: "Ready for QA", hint: "Waiting for QA to begin testing", tone: "bg-teal-500/15 text-teal-800 dark:text-teal-300", drop: null },
  { status: "Testing", title: "Testing", hint: "Being tested", tone: "bg-violet-500/15 text-violet-800 dark:text-violet-300", drop: "Testing" },
  { status: "Done", title: "Done", hint: "Testing completed", tone: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300", drop: "Done" },
] as const;

export const qaColumn = (status: string) => QA_COLUMNS.find((c) => c.status === status);

export type SortKey = "id" | "title" | "status" | "priority" | "assignee" | "team" | "tickets";
export type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3, "Not set": 4 };
const STATUS_RANK: Record<string, number> = { "Ready for QA": 0, Testing: 1, Done: 2 };

/** Sorts a copy of the tasks (the default is by status in flow order, newest first within it). `names` and `teams` give the text each task shows for those columns. */
export function sortTasks(tasks: readonly BacklogItemData[], sort: Sort, names: (t: BacklogItemData) => string, teams: (t: BacklogItemData) => string): BacklogItemData[] {
  const num = (t: BacklogItemData) => t.apiId ?? 0;
  if (!sort) return [...tasks].sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || num(b) - num(a));
  const value = (t: BacklogItemData): number | string => {
    switch (sort.key) {
      case "id": return num(t);
      case "title": return t.title.toLowerCase();
      case "status": return STATUS_RANK[t.status] ?? 9;
      case "priority": return PRIORITY_RANK[t.priority] ?? 9;
      case "assignee": return names(t).toLowerCase();
      case "team": return teams(t).toLowerCase();
      case "tickets": return t.ticketStats?.total ?? 0;
    }
  };
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sign || num(b) - num(a);
  });
}
