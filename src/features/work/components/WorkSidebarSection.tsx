"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import RailTip from "@/components/ui/RailTip";
import { CheckCircleIcon, ClockIcon, ListIcon, OverviewIcon, UsersIcon } from "@/components/ui/icons";
import { MY_TASK_HREF, OVERVIEW_HREF, WORK_HREF, WORK_LOGGED_HREF, WORK_TEAM_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";

/**
 * Sidebar block for the work section ("Work & Team" for a Super Admin and an enabled Admin, "My Work" for everyone else). It is its own block, separate from
 * the Backlog heading and navigation, and sits after the Backlog group.
 */
export default function WorkSidebarSection() {
  const pathname = usePathname();
  const { isAdmin, restricted } = useAuth();
  // Log Work is only its own page: Your Logged Work lives under the same path but is a different menu item.
  const on = (href: string) => (href === WORK_HREF ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <section aria-labelledby="sidebar-work-heading" className="sb-section rounded-xl border border-border bg-background/60 p-2">
      <h2 id="sidebar-work-heading" className="sb-label text-base font-semibold">
        {isAdmin ? "Work & Team" : "My Work"}
      </h2>
      <p className="sb-label mt-1 text-xs leading-relaxed text-muted">{isAdmin ? "Log your hours and follow the team's work." : "Log your hours against the sprint."}</p>
      <div className="mt-3 flex flex-col gap-1">
        {[
          // Everyone else's Overview is in the Backlog menu; a Team Member's own is here.
          ...(restricted ? [{ href: OVERVIEW_HREF, label: "My Overview", Icon: OverviewIcon }] : []),
          { href: WORK_HREF, label: "Log Work Sprint", Icon: ClockIcon },
          // Everyone's PODs and work: only for a Super Admin and an enabled Admin.
          ...(isAdmin ? [{ href: WORK_TEAM_HREF, label: "Team Work Details", Icon: UsersIcon }] : []),
          { href: WORK_LOGGED_HREF, label: "Your Logged Work", Icon: CheckCircleIcon },
          { href: MY_TASK_HREF, label: "My Task", Icon: ListIcon },
        ].map(({ href, label, Icon }) => {
          const active = on(href);
          return (
            <RailTip key={href} label={label}>
            <Link
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`sb-item group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
                active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="anim-indicator absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent"
                />
              )}
              <Icon className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span className="sb-label truncate">{label}</span>
            </Link>
            </RailTip>
          );
        })}
      </div>
    </section>
  );
}
