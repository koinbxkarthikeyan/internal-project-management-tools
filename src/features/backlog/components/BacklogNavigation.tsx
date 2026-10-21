"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  CheckCircleIcon,
  FolderIcon,
  ListIcon,
  OverviewIcon,
  SettingsIcon,
  SprintIcon,
  UploadIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { DisabledTip } from "@/components/ui/DisabledTip";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useBacklog } from "../context/BacklogContext";
import { BACKLOG_NAV_ITEMS, type BacklogNavId } from "@/constants/backlog-sidebar";
import { NAV_ITEMS } from "@/constants/navigation";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

const BACKLOG_ICONS: Record<BacklogNavId, IconType> = {
  overview: OverviewIcon,
  "all-items": ListIcon,
  "sprint-plan": SprintIcon,
  completed: CheckCircleIcon,
  "owners-sprints": UsersIcon,
};

const WORKSPACE_ICONS: Record<string, IconType> = {
  "/dashboard": OverviewIcon,
  "/projects": FolderIcon,
  "/users": UsersIcon,
  "/bulk-upload": UploadIcon,
  "/settings": SettingsIcon,
};

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const itemClass = (active: boolean) =>
  `sb-item group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
    active
      ? "bg-accent-soft font-medium text-accent"
      : "text-muted hover:bg-hover hover:text-foreground"
  }`;

function ActiveIndicator() {
  return (
    <span
      aria-hidden="true"
      className="anim-indicator absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent"
    />
  );
}

type BacklogNavigationProps = {
  /** Rendered between the Backlog group and the Workspace group. */
  between?: ReactNode;
};

export default function BacklogNavigation({ between }: BacklogNavigationProps) {
  const pathname = usePathname();
  const { status, items } = useBacklog();
  const { isAdmin } = useAuth();
  const workspaceItems = NAV_ITEMS.filter((item) => (item.href === "/users" || item.href === "/bulk-upload") && isAdmin);
  const completed = items.filter((i) => i.status === "Completed").length;
  // Counts appear once the data has loaded.
  const counts: Partial<Record<BacklogNavId, number>> =
    status === "ready"
      ? { overview: items.length - completed, "all-items": items.length, completed }
      : {};

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      <div>
        <p id="sidebar-backlog-nav" className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted">
          Backlog
        </p>
        <ul aria-labelledby="sidebar-backlog-nav" className="flex flex-col gap-1">
          {BACKLOG_NAV_ITEMS.map(({ id, label, href }) => {
            const count = counts[id];
            const Icon = BACKLOG_ICONS[id];
            const active = isActive(pathname, href);
            // An empty list can't be opened (the page you are on stays reachable).
            const disabled = !active && count === 0;
            const content = (
              <>
                <Icon className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span className="flex-1 truncate">{label}</span>
                {count !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      active ? "bg-[#425df3] font-semibold text-white dark:bg-accent dark:text-accent-foreground" : "bg-hover text-muted"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </>
            );
            return (
              <li key={id}>
                <DisabledTip reason={disabled && `There are no ${label.toLowerCase()} to show yet.`} className="block">
                {disabled ? (
                  <span aria-disabled="true" className={`${itemClass(false)} cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted`}>
                    {content}
                  </span>
                ) : (
                  <Link href={href} aria-current={active ? "page" : undefined} className={itemClass(active)}>
                    {active && <ActiveIndicator />}
                    {content}
                  </Link>
                )}
                </DisabledTip>
              </li>
            );
          })}
        </ul>
      </div>

      {between}

      {/* Only Users is listed here (Admins only); Dashboard, Projects and Settings keep their pages but have no menu item. */}
      {workspaceItems.length > 0 && (
      <div>
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wide text-muted">
          Workspace
        </p>
        <ul className="flex flex-col gap-1">
          {workspaceItems.map(({ href, label }) => {
            const Icon = WORKSPACE_ICONS[href];
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={itemClass(active)}
                >
                  {active && <ActiveIndicator />}
                <Icon className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      )}
    </nav>
  );
}
