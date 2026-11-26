import type { ComponentType, SVGProps } from "react";
import { CheckCircleIcon, ClockIcon, EyeIcon, ListIcon, OverviewIcon, SettingsIcon, SprintIcon, UploadIcon, UsersIcon } from "@/components/ui/icons";
import { BACKLOG_NAV_ITEMS } from "@/constants/backlog-sidebar";
import { MESSAGES_HREF, MESSAGES_LABEL, MY_TASK_HREF, OVERVIEW_HREF, READY_FOR_QA_HREF, WORK_HREF, WORK_LOGGED_HREF, WORK_TEAM_HREF } from "@/constants/work";

export type PageEntry = { href: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> };

const BACKLOG_ICONS: Record<string, PageEntry["Icon"]> = {
  "/overview": OverviewIcon,
  "/all-items": ListIcon,
  "/sprint-plan": SprintIcon,
  [READY_FOR_QA_HREF]: EyeIcon,
  "/completed": CheckCircleIcon,
  "/owners-sprints": UsersIcon,
};

/** Every page of the app that has a place in the sidebar, whoever may open it. */
const BACKLOG_PAGES: PageEntry[] = BACKLOG_NAV_ITEMS.map((n) => ({ href: n.href, label: n.label, Icon: BACKLOG_ICONS[n.href] ?? ListIcon }));
const WORK_PAGES: PageEntry[] = [
  { href: WORK_HREF, label: "Log Work Sprint", Icon: ClockIcon },
  { href: WORK_LOGGED_HREF, label: "Your Logged Work", Icon: CheckCircleIcon },
  { href: MY_TASK_HREF, label: "My Task", Icon: ListIcon },
  { href: MESSAGES_HREF, label: MESSAGES_LABEL, Icon: UsersIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];
const ADMIN_PAGES: PageEntry[] = [
  { href: "/users", label: "Users", Icon: UsersIcon },
  { href: "/bulk-upload", label: "Bulk upload", Icon: UploadIcon },
  { href: WORK_TEAM_HREF, label: "Team Work Details", Icon: UsersIcon },
];

/** The pages a person can open: everyone gets the work pages (a normal User's Overview is "My Overview"); admins also get the backlog pages, Users, Bulk upload and Team Work Details. */
export function pagesFor({ restricted, isAdmin }: { restricted: boolean; isAdmin: boolean }): PageEntry[] {
  return [
    ...(restricted ? [{ href: OVERVIEW_HREF, label: "My Overview", Icon: OverviewIcon }] : BACKLOG_PAGES),
    ...WORK_PAGES,
    ...(isAdmin ? ADMIN_PAGES : []),
  ];
}
