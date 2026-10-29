"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import RailTip from "@/components/ui/RailTip";
import ThemeMenu from "@/components/ui/ThemeMenu";
import NotificationBell from "@/features/notifications/components/NotificationBell";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, MenuIcon } from "@/components/ui/icons";
import { DEFAULT_REDIRECT } from "@/constants/auth";
import { WORK_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useSidebarStore } from "@/stores/sidebarStore";

type SidebarProps = {
  children: ReactNode;
};

/** The logo, as a link to Overview. A User, or an account with access Disabled, cannot open Overview, so for them it goes to the page they can use (as after sign-in). */
function LogoLink() {
  const { restricted, settingsOnly } = useAuth();
  const href = settingsOnly ? "/settings" : restricted ? WORK_HREF : DEFAULT_REDIRECT;
  return (
    <Link href={href} aria-label="Go to Overview" title="Overview" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <span className="sb-full inline-flex"><Logo /></span>
      <span className="sb-mini"><Logo variant="mark" /></span>
    </Link>
  );
}

/** A small tab on the sidebar's right edge (desktop only) that collapses it to an icon rail and back. Expanded, it sits inside the sidebar with its rounded side facing in; collapsed, it sits outside the rail. It is the only thing that changes the width: hovering never does. */
function CollapseTab() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  return (
    <RailTip label={label} always className={`absolute top-5 z-10 hidden transition-[right] duration-200 ease-in-out motion-reduce:transition-none lg:block ${collapsed ? "-right-[22px]" : "right-0"}`}>
      <button
        type="button"
        onClick={() => useSidebarStore.getState().toggle()}
        aria-label={label}
        aria-expanded={!collapsed}
        className={`inline-flex h-9 w-[22px] items-center justify-center bg-accent text-accent-foreground transition-[filter,transform,border-radius] duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          collapsed ? "rounded-l-none rounded-r-full pr-0.5 hover:translate-x-0.5" : "rounded-l-full rounded-r-none pl-0.5 hover:-translate-x-0.5"
        }`}
      >
        {collapsed ? <ChevronRightIcon width={14} height={14} strokeWidth={2.5} /> : <ChevronLeftIcon width={14} height={14} strokeWidth={2.5} />}
      </button>
    </RailTip>
  );
}

/** Responsive sidebar shell: fixed on desktop, slide-over drawer below `lg`. */
export default function Sidebar({ children }: SidebarProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => useSidebarStore.getState().start(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Close the drawer after navigating via any link inside it.
  function handleClick(e: MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest("a, [data-close-sidebar]")) setOpen(false);
  }

  return (
    <>
      {/* Below lg: one header row with the logo on the left, and the theme toggle and menu button on the right. */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <LogoLink />
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeMenu />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open sidebar"
            aria-expanded={open}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-hover"
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-[180ms] ease-in-out lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        onClick={handleClick}
        className={`sb-rail fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <CollapseTab />
        <div className="sb-head sb-pad flex items-center justify-between px-5 pb-2 pt-5 lg:pr-8">
          <LogoLink />
          <div className="sb-controls flex items-center gap-2">
            <div className="sb-controls hidden items-center gap-2 lg:flex">
              <NotificationBell />
              <ThemeMenu />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close sidebar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-hover hover:text-foreground lg:hidden"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        {children}
      </aside>
    </>
  );
}
