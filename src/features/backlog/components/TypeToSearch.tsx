"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { canPressB, canPressO, canPressT } from "../shortcuts";

/**
 * Typing anywhere on a page that has a search box (outside a field, with no form open) moves the cursor into it, and what was typed lands there. `/` does the same, empty.
 * Keys that open forms (B, O and T where they create, ?) and the tab keys 1 2 3 are left to them; a page with no search box (the Sprint plan has its own search form) is untouched.
 */
export default function TypeToSearch() {
  const { isAdmin, restricted } = useAuth();
  const pathname = usePathname();
  const view = useSearchParams().get("view");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.defaultPrevented || e.isComposing) return;
      const slash = e.key === "/";
      if (!slash && (e.key.length !== 1 || e.key === " " || e.key === "?" || e.key === "+" || e.key === "=" || (e.key >= "1" && e.key <= "3"))) return;
      const k = e.key.toLowerCase();
      if (!restricted && ((k === "b" && canPressB(pathname, view)) || (isAdmin && ((k === "o" && canPressO(pathname)) || (k === "t" && canPressT(pathname)))))) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=''], [contenteditable=true], [role=combobox]")) return;
      if (document.querySelector("dialog[open]")) return;
      const box = document.querySelector<HTMLInputElement>("main input[type=search]:not([disabled])");
      if (!box || box.offsetParent === null) return;
      box.focus();
      if (slash) e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pathname, view, isAdmin, restricted]);

  return null;
}
