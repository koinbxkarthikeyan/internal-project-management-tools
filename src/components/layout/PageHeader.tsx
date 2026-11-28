"use client";

import { usePathname } from "next/navigation";
import { createElement, type ComponentType, type ReactNode, type SVGProps } from "react";
import { BoardIcon, ChatIcon, CheckCircleIcon, ClockIcon, EyeIcon, ListIcon, OverviewIcon, SprintIcon, UploadIcon, UsersIcon } from "@/components/ui/icons";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /**
   * On a phone (under 640px) keep the title and the actions on ONE row (the title shortens with "…", the actions stay) with the description on its own row under them. From sm up the
   * header is the usual one: the text on the left, the actions on the right.
   */
  oneLine?: boolean;
};

type PageIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** The icon of each area, the same ones the sidebar uses; the longest matching path wins (so "/my-sprint/team" is not "/my-sprint"). */
const PAGE_ICONS: [string, PageIcon][] = [
  ["/overview", OverviewIcon],
  ["/all-items", ListIcon],
  ["/backlog", ListIcon],
  ["/sprint-plan", SprintIcon],
  ["/qa-workspace", EyeIcon],
  ["/completed", CheckCircleIcon],
  ["/owners-sprints", UsersIcon],
  ["/my-task", BoardIcon],
  ["/my-sprint/team", UsersIcon],
  ["/my-sprint/logged", CheckCircleIcon],
  ["/my-sprint", ClockIcon],
  ["/users", UsersIcon],
  ["/bulk-upload", UploadIcon],
  ["/messages", ChatIcon],
];
const iconFor = (path: string): PageIcon | undefined => PAGE_ICONS.filter(([p]) => path === p || path.startsWith(`${p}/`)).sort((a, b) => b[0].length - a[0].length)[0]?.[1];

/** The page's icon, small and in the accent colour, written before its title. */
function TitleIcon() {
  const Icon = iconFor(usePathname());
  return Icon ? <span aria-hidden="true" className="shrink-0 text-accent">{createElement(Icon, { width: 22, height: 22 })}</span> : null;
}

export default function PageHeader({ title, description, actions, oneLine = false }: PageHeaderProps) {
  if (oneLine)
    return (
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="contents sm:block sm:min-w-0 sm:flex-1 sm:basis-72">
          <h1 className="row-start-1 flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight sm:overflow-visible"><TitleIcon /><span className="min-w-0 truncate sm:whitespace-normal">{title}</span></h1>
          {description && <div className="col-span-2 row-start-2 min-w-0 text-sm text-muted sm:col-auto sm:row-auto sm:mt-1">{description}</div>}
        </div>
        {actions && <div className="col-start-2 row-start-1 shrink-0 sm:col-auto sm:row-auto">{actions}</div>}
      </header>
    );
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      {/* The text takes the free width (so a long description doesn't push the action down); it wraps under only on narrow screens. */}
      <div className="min-w-0 flex-1 basis-72">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><TitleIcon />{title}</h1>
        {description && <div className="mt-1 max-w-3xl truncate text-sm text-muted">{description}</div>}
      </div>
      {/* The actions are centred on the title line, whatever they are (a button, a status text, a switch), and the description wraps at one comfortable width on every page. */}
      {actions && <div className="flex min-h-10 shrink-0 items-center">{actions}</div>}
    </header>
  );
}
