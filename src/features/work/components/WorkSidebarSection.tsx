"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircleIcon, ClockIcon, ListIcon } from "@/components/ui/icons";
import { MY_TASK_HREF, WORK_HREF, WORK_LOGGED_HREF } from "@/constants/work";

/**
 * Sidebar block for the "What are you working on?" section. It is its own block, separate from
 * the Backlog heading and navigation, and sits after the Backlog group.
 */
export default function WorkSidebarSection() {
  const pathname = usePathname();
  // Log Work is only its own page: Your Logged Work lives under the same path but is a different menu item.
  const on = (href: string) => (href === WORK_HREF ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <section aria-labelledby="sidebar-work-heading" className="rounded-xl border border-border bg-background/60 p-2">
      <h2 id="sidebar-work-heading" className="text-base font-semibold">
        What are you working on?
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">Log your hours against the sprint.</p>
      <div className="mt-3 flex flex-col gap-1">
        {[
          { href: WORK_HREF, label: "Log Work Sprint", Icon: ClockIcon },
          { href: WORK_LOGGED_HREF, label: "Your Logged Work", Icon: CheckCircleIcon },
          { href: MY_TASK_HREF, label: "My Task", Icon: ListIcon },
        ].map(({ href, label, Icon }) => {
          const active = on(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent ${
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
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
