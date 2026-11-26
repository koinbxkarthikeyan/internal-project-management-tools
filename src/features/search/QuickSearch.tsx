"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/Badge";
import { MESSAGES_HREF, MY_TASK_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { searchAll, type Found } from "@/services/searchService";

type Row = { key: string; label: string; sub: string; href: string; status?: Found["items"][number]["status"] };

/** Ctrl+K (or ⌘K) from anywhere: type a task or Ticket code or title, or a person's name, and Enter opens it (a person opens a direct chat). */
export default function QuickSearch() {
  const { status: signedIn, settingsOnly } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const term = q.trim();
    if (!term) return;
    // A short pause after the last key, so a request is not sent for every letter.
    const timer = setTimeout(() => void searchAll(term).then((f) => (setFound(f), setAt(0)), () => setFound({ items: [], people: [] })), 180);
    return () => clearTimeout(timer);
  }, [q, open]);

  if (signedIn !== "signedIn" || settingsOnly || !open) return null;

  const rows: Row[] = [
    ...(found?.items ?? []).map((i) => ({
      key: `i${i.id}`,
      label: `${i.code} · ${i.title}`,
      sub: i.isTicket ? "Ticket" : "Task",
      // A Ticket opens its own page; a task opens its page (both in My Task, which every role has).
      href: i.isTicket ? `${MY_TASK_HREF}/ticket?id=${i.id}` : `${MY_TASK_HREF}/task?id=${i.id}`,
      status: i.status,
    })),
    ...(found?.people ?? []).map((p) => ({ key: `p${p.id}`, label: p.name, sub: p.team ? `Message · ${p.team}` : "Message", href: `${MESSAGES_HREF}?open=dm:${p.id}` })),
  ];
  const close = () => (setOpen(false), setQ(""), setFound(null));
  const go = (r: Row | undefined) => r && (close(), router.push(r.href));

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[15vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-label="Quick search" className="anim-fade-up w-full max-w-xl overflow-hidden card shadow-modal">
        <input
          ref={input}
          value={q}
          onChange={(e) => (setQ(e.target.value), q.trim() === "" && setFound(null))}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setAt((i) => Math.min(rows.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAt((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(rows[at]);
            }
          }}
          style={{ outline: "none" }}
          placeholder="Search tasks, Tickets and people…"
          aria-label="Search tasks, Tickets and people"
          className="h-12 w-full border-b border-border bg-transparent px-4 text-base placeholder:text-muted"
        />
        <ul role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1.5">
          {!q.trim() && <li className="px-3 py-3 text-sm text-muted">Type a code like BLG-12 or TKT-004, a title, or a person&apos;s name.</li>}
          {q.trim() && found && rows.length === 0 && <li role="status" className="px-3 py-3 text-sm text-muted">Nothing matches &ldquo;{q.trim()}&rdquo;.</li>}
          {rows.map((r, i) => (
            <li key={r.key} role="option" aria-selected={i === at}>
              <button type="button" onClick={() => go(r)} onMouseEnter={() => setAt(i)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === at ? "bg-hover" : ""}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.label}</span>
                  <span className="block text-xs text-muted">{r.sub}</span>
                </span>
                {r.status && <StatusBadge status={r.status} />}
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-border px-4 py-2 text-xs text-muted">↑ ↓ to move · Enter to open · Esc to close</p>
      </div>
    </div>
  );
}
