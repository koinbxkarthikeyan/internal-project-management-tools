export type BacklogNavId =
  | "overview"
  | "all-items"
  | "sprint-plan"
  | "ready-for-qa"
  | "completed"
  | "owners-sprints";

export const BACKLOG_NAV_ITEMS: readonly {
  id: BacklogNavId;
  label: string;
  href: string;
}[] = [
  { id: "overview", label: "Overview", href: "/overview" },
  { id: "all-items", label: "All items", href: "/all-items" },
  { id: "sprint-plan", label: "Sprint plan", href: "/sprint-plan" },
  { id: "ready-for-qa", label: "QA Workspace", href: "/qa-workspace" },
  { id: "completed", label: "Done", href: "/completed" },
  { id: "owners-sprints", label: "Owners & sprints", href: "/owners-sprints" },
];
