"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import UserFormDrawer from "@/features/users/components/UserFormDrawer";
import { refreshUsers } from "@/lib/auth/userStore";
import { canPressB, canPressO, canPressS, canPressT } from "../shortcuts";
import { useBacklog } from "../context/BacklogContext";
import BacklogDrawer from "./BacklogDrawer";
import CreateOwnerDrawer from "./CreateOwnerDrawer";

/**
 * Single-key shortcuts for the create forms, each only on the page that needs it and for the people allowed to use it (see shortcuts.ts); ? lists the ones for the current page. They work anywhere in the app except while typing in a field or while a form is open;
 * Owner and Team Member are for admins only, as their buttons are. The small forms open in their usual place (the middle of the right half).
 */
export default function QuickCreateShortcuts() {
  const { user, settingsOnly, isAdmin, isSuperAdmin, restricted } = useAuth();
  const { openCreate } = useBacklog();
  const toast = useToast();
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const [form, setForm] = useState<"owner" | "member" | "help" | null>(null);

  // Told once per browser, on a screen with a keyboard, that the shortcuts exist.
  useEffect(() => {
    if (!user || settingsOnly || window.innerWidth < 1024) return;
    try {
      if (localStorage.getItem("koinbx_shortcuts_tip")) return;
      localStorage.setItem("koinbx_shortcuts_tip", "1");
    } catch {
      return;
    }
    toast.show("Tip: press ? to see the keyboard shortcuts for the page you are on.", "info", 10000);
    // Once, when the app opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user || settingsOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=''], [contenteditable=true], [role=combobox]")) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "?") {
        setForm("help");
        e.preventDefault();
        return;
      }
      if (e.shiftKey) return;
      const key = e.key.toLowerCase();
      if (key === "b" && !restricted && canPressB(pathname, view)) openCreate();
      else if (key === "o" && isAdmin && canPressO(pathname)) setForm("owner");
      else if (key === "t" && isAdmin && canPressT(pathname)) setForm("member");
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [user, settingsOnly, isAdmin, restricted, openCreate, pathname, view]);

  if (form === "help") {
    const rows: [string, string][] = [
      ...(!restricted && canPressB(pathname, view) ? ([["B", "Create backlog"]] as [string, string][]) : []),
      ...(isAdmin && canPressO(pathname) ? ([["O", "Create owner"]] as [string, string][]) : []),
      ...(isAdmin && canPressT(pathname) ? ([["T", "Add team member"]] as [string, string][]) : []),
      ...(canPressS(pathname) ? ([["S", "Plan new sprint"]] as [string, string][]) : []),
      ["Ctrl + F", "Expand a form or panel"],
      ["Esc", "Shrink it, then close"],
      ["?", "Show this list"],
    ];
    return (
      <BacklogDrawer heading="Keyboard shortcuts" subtitle="Work faster without the mouse." submitLabel="Close" compact viewOnly onSubmit={() => {}} onClose={() => setForm(null)}>
        <ul className="divide-y divide-border text-sm">
          {rows.map(([key, what]) => (
            <li key={key} className="flex items-center justify-between gap-4 py-2">
              <span>{what}</span>
              <kbd className="rounded border border-border bg-hover px-2 py-0.5 text-xs font-medium">{key}</kbd>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Letter keys work when you&apos;re not typing in a field.</p>
      </BacklogDrawer>
    );
  }
  if (form === "owner") return <CreateOwnerDrawer showRole={false} onClose={() => setForm(null)} />;
  if (form === "member") return <UserFormDrawer canSetStatus={isSuperAdmin} onClose={() => setForm(null)} onSaved={() => refreshUsers(true)} />;
  return null;
}
