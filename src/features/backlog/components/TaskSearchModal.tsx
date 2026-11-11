"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { sprintLabel } from "@/constants/backlog-options";
import type { BacklogItemData } from "@/types/backlog";
import BacklogDrawer from "./BacklogDrawer";

const MAX = 50;

/**
 * Type-to-search for the Sprint page (a big form in the middle of the screen, unlike the small create forms): typing anywhere on the page (outside a field or an open form) opens this small search with what was typed, over every task
 * loaded (Backlog and every sprint, hidden ones too). `/` opens it empty. Arrow keys move through the results, Enter opens one.
 */
export default function TaskSearchModal({ tasks, onPick, reserved = [] }: { tasks: BacklogItemData[]; onPick: (task: BacklogItemData) => void; /** Keys kept for other shortcuts on the page. */ reserved?: string[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.defaultPrevented || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=''], [contenteditable=true], [role=combobox]")) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "/") setQuery("");
      else if (e.key.length === 1 && e.key !== " " && e.key !== "?" && !reserved.includes(e.key.toLowerCase())) setQuery(e.key);
      else return;
      e.preventDefault();
      setAt(0);
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [reserved]);

  const found = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return tasks.filter((t) => {
      const hay = [t.id, t.title, t.owner, t.assignees, t.lead, t.type, t.status, sprintLabel(t.sprint)].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [tasks, query]);

  if (!open) return null;
  const shown = found.slice(0, MAX);
  const pick = (t: BacklogItemData) => {
    setOpen(false);
    onPick(t);
  };

  return (
    <BacklogDrawer heading="Search tasks" subtitle="Every task, in the Backlog and in every sprint." submitLabel="Close" viewOnly onSubmit={() => {}} onClose={() => setOpen(false)}>
      <div className="flex flex-col gap-3">
        <input
          data-autofocus
          type="search"
          value={query}
          aria-label="Search tasks"
          placeholder="Title, code, owner, sprint…"
          onChange={(e) => (setQuery(e.target.value), setAt(0))}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setAt((a) => Math.max(0, Math.min(shown.length - 1, a + (e.key === "ArrowDown" ? 1 : -1))));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (shown[at]) pick(shown[at]);
            }
          }}
          className="h-10 w-full field px-3 text-sm placeholder:text-muted"
        />
        {!query.trim() ? (
          <p className="text-xs text-muted">Start typing to search.</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted" role="status">No task matches.</p>
        ) : (
          <ul role="listbox" aria-label="Matching tasks" className="-mx-1 max-h-[calc(100dvh-17rem)] min-h-40 divide-y divide-border overflow-y-auto">
            {shown.map((t, i) => (
              <li key={t.id} role="option" aria-selected={i === at}>
                <button type="button" onClick={() => pick(t)} onMouseEnter={() => setAt(i)} className={`flex w-full flex-col gap-1 rounded-lg px-2 py-2 text-left ${i === at ? "bg-hover" : ""}`}>
                  <span className="truncate text-sm font-medium">{t.title}</span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span>{t.id}</span>
                    <span>{sprintLabel(t.sprint)}</span>
                    <span>{t.owner}</span>
                    <StatusBadge status={t.status} />
                    {t.hidden && <span>Hidden</span>}
                  </span>
                </button>
              </li>
            ))}
            {found.length > MAX && <li className="px-2 py-2 text-xs text-muted">Showing the first {MAX}. Type more to narrow it.</li>}
          </ul>
        )}
      </div>
    </BacklogDrawer>
  );
}
