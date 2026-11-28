"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePagesStore } from "@/stores/pagesStore";
import { pagesFor, type PageEntry } from "../pageList";

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  </svg>
);

/**
 * "Search for any page" on Overview: type to filter, arrow keys to move, Enter to open, Esc to clear. A star on each result pins it (amber chips under the box);
 * the last six pages opened show as dashed orange chips. It lists only the pages the person can open.
 */
export default function PageFinder() {
  const router = useRouter();
  const { restricted, isAdmin } = useAuth();
  const { pins, recents } = usePagesStore();
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const listId = useId();

  const pages = useMemo(() => pagesFor({ restricted, isAdmin }), [restricted, isAdmin]);
  const byHref = useMemo(() => new Map(pages.map((p) => [p.href, p])), [pages]);
  const term = q.trim().toLowerCase();
  const results = term ? pages.filter((p) => p.label.toLowerCase().includes(term)) : [];
  const pinned = pins.flatMap((h) => byHref.get(h) ?? []);
  const recent = recents.flatMap((h) => byHref.get(h) ?? []);
  const active = Math.min(at, Math.max(0, results.length - 1));

  const open = (p: PageEntry | undefined) => p && (setQ(""), router.push(p.href));
  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length) setAt((active + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      open(results[active]);
    } else if (e.key === "Escape" && q) {
      e.stopPropagation();
      setQ("");
    }
  }

  const chip = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent";
  const heading = "text-[11px] font-semibold uppercase tracking-wider text-muted";
  return (
    <section aria-label="Find a page" className="card">
      <div className="relative p-3">
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-accent">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4 4" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => (setQ(e.target.value), setAt(0))}
          onKeyDown={onKey}
          placeholder="Search for any page"
          aria-label="Search for any page"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm outline-none placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
        />
        {term && (
          <ul id={listId} role="listbox" className="absolute inset-x-3 top-full z-20 -mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-lg">
            {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">No page matches “{q.trim()}”.</li>}
            {results.map((p, i) => (
              <li key={p.href} id={`${listId}-${i}`} role="option" aria-selected={i === active} onPointerEnter={() => setAt(i)} className={`flex items-center gap-1 rounded-lg ${i === active ? "bg-hover" : ""}`}>
                <button type="button" onClick={() => open(p)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-accent">
                  <p.Icon className="shrink-0 text-muted" />
                  <span className="truncate">{p.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => usePagesStore.getState().togglePin(p.href)}
                  aria-label={pins.includes(p.href) ? `Unpin ${p.label}` : `Pin ${p.label}`}
                  aria-pressed={pins.includes(p.href)}
                  className={`mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-accent ${pins.includes(p.href) ? "text-amber-500" : "text-muted"}`}
                >
                  <StarIcon filled={pins.includes(p.href)} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Pinned on the left, Recent on the right, with a thin line between them. */}
      <div className="grid gap-4 border-t border-border px-4 py-3.5 md:grid-cols-2 md:gap-0">
        <div className="md:border-r md:border-border md:pr-5">
          <h3 className={heading}>Pinned</h3>
          {pinned.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Search for a page and click its star to pin it here.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {pinned.map((p) => (
                <Link key={p.href} href={p.href} className={`${chip} bg-amber-400/15 text-amber-700 hover:bg-amber-400/25 dark:text-amber-300`}>
                  <StarIcon filled />
                  {p.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="md:pl-5">
          <h3 className={heading}>Recent</h3>
          {recent.length === 0 ? (
            <p className="mt-2 text-xs text-muted">Pages you open will show here.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {recent.map((p) => (
                <Link key={p.href} href={p.href} className={`${chip} border border-dashed border-orange-400/60 bg-orange-400/10 text-orange-700 hover:bg-orange-400/20 dark:text-orange-300`}>
                  {p.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
