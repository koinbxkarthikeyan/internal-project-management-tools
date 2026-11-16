"use client";

import { useEffect } from "react";

/**
 * The Down / Up arrow keys for the arrow buttons that open a section under a task (a row's or card's Tickets and comments, a Ticket's summary, the task's details): anywhere on the
 * page, Down opens the first closed one and Up closes the last open one, so they work without focusing the button first. The buttons are marked `data-disclosure`. Nothing happens
 * while typing, choosing from a list or menu, or with a form open, so the arrow keys keep their usual jobs there; once everything is open (or closed) they scroll the page as usual.
 */
export default function ArrowDisclosure() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.key || (e.key !== "ArrowDown" && e.key !== "ArrowUp") || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=''], [contenteditable=true], [role=combobox], [role=listbox], [role=menu], [role=option], [role=menuitem], [role=tab]")) return;
      if (document.querySelector("dialog[open]")) return;
      const all = [...document.querySelectorAll<HTMLButtonElement>("main button[data-disclosure]:not(:disabled)")].filter((b) => b.offsetParent !== null);
      const target = e.key === "ArrowDown" ? all.find((b) => b.getAttribute("aria-expanded") === "false") : [...all].reverse().find((b) => b.getAttribute("aria-expanded") === "true");
      if (!target) return;
      e.preventDefault();
      target.click();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
