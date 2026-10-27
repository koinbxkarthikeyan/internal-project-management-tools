"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { DEFAULT_REDIRECT } from "@/constants/auth";
import { WORK_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";

type SidebarProps = {
  children: ReactNode;
};

/** The logo, as a link to Overview. A User, or an account with access Disabled, cannot open Overview, so for them it goes to the page they can use (as after sign-in). */
function LogoLink() {
  const { restricted, settingsOnly } = useAuth();
  const href = settingsOnly ? "/settings" : restricted ? WORK_HREF : DEFAULT_REDIRECT;
  return (
    <Link href={href} aria-label="Go to Overview" title="Overview" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <Logo />
    </Link>
  );
}

/** Responsive sidebar shell: fixed on desktop, slide-over drawer below `lg`. */
export default function Sidebar({ children }: SidebarProps) {
  const [open, setOpen] = useState(false);

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
          <ThemeToggle />
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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <LogoLink />
          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <ThemeToggle />
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
