"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type PickOption = { value: string; label: string; hint?: string };

type CellPickerProps = {
  options: readonly PickOption[];
  /** The values of the options that are chosen right now. */
  selected: readonly string[];
  /** What the cell shows (the chosen names, or the raw text of a choice that no longer exists). */
  display: string;
  multi?: boolean;
  /** Lets text that is not in the list be used as the value (for a free-text field with suggestions, such as Team). */
  allowCustom?: boolean;
  /** Picks an option (single: sets it; multi: toggles it). An empty string clears a single choice. */
  onSelect: (value: string) => void;
  emptyLabel: string;
  ariaLabel: string;
  invalid?: boolean;
  disabled?: boolean;
  /** An action row at the end of the list, e.g. "+ Create New Owner". */
  createLabel?: string;
  onCreate?: () => void;
};

/** A list this long (or any list with several choices, or free text) gets a search box; a short fixed list does not need one. */
const SEARCH_FROM = 7;

/**
 * The table cell's version of the app's standard dropdown (the Status field in the Backlog form): the same field, arrow, list, spacing, hover and
 * selected look. The list is a top-layer popover placed from the cell's position on screen, so the table's own scrolling never clips it; it flips
 * above the cell when there is no room below and closes when the page or table scrolls.
 */
export default function CellPicker({ options, selected, display, multi = false, allowCustom = false, onSelect, emptyLabel, ariaLabel, invalid, disabled, createLabel, onCreate }: CellPickerProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const searchable = multi || allowCustom || options.length >= SEARCH_FROM;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !q || o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q));
  }, [options, query]);
  const typed = query.trim();
  const customRow = allowCustom && typed && !options.some((o) => o.label.toLowerCase() === typed.toLowerCase());
  // Rows in the list: (single choice only) "no choice", then the matching options, then the typed text, then the create action.
  const rows = [
    ...(!multi ? [{ kind: "none" as const }] : []),
    ...shown.map((o) => ({ kind: "option" as const, o })),
    ...(customRow ? [{ kind: "custom" as const, text: typed }] : []),
    ...(onCreate && createLabel ? [{ kind: "create" as const }] : []),
  ];

  function close(returnFocus = false) {
    setOpen(false);
    setQuery("");
    if (returnFocus) trigger.current?.focus();
  }

  function choose(i: number) {
    const row = rows[i];
    if (!row) return;
    if (row.kind === "create") {
      close();
      onCreate?.();
    } else if (row.kind === "none") {
      onSelect("");
      close(true);
    } else if (row.kind === "custom") {
      onSelect(row.text);
      close(true);
    } else {
      onSelect(row.o.value);
      if (!multi) close(true);
    }
  }

  useEffect(() => {
    const el = panel.current;
    const anchor = trigger.current;
    if (!el || !anchor || typeof el.showPopover !== "function") return;
    if (!open) {
      if (el.matches(":popover-open")) el.hidePopover();
      return;
    }
    el.showPopover();
    const place = () => {
      const r = anchor.getBoundingClientRect();
      // As wide as the field (like the standard dropdown); a list that shows e-mail addresses gets a little more room.
      const w = Math.max(r.width, options.some((o) => o.hint) ? 260 : 180);
      const h = el.offsetHeight;
      const below = window.innerHeight - r.bottom - 8;
      const flip = below < Math.min(h, 240) && r.top > below;
      el.style.width = `${w}px`;
      el.style.left = `${Math.min(Math.max(8, r.left), window.innerWidth - w - 8)}px`;
      el.style.top = `${flip ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
    };
    place();
    requestAnimationFrame(() => (searchable ? search.current : trigger.current)?.focus({ preventScroll: true }));
    const outside = (e: MouseEvent) => {
      if (!el.contains(e.target as Node) && !anchor.contains(e.target as Node)) close();
    };
    // Scrolling the page or the table closes it (its list may scroll on its own); a resize does too.
    const openedAt = performance.now();
    const onScroll = (e: Event) => {
      // (Scrolling the cell into view as it is opened is not the person scrolling away.)
      if (performance.now() - openedAt > 300 && !el.contains(e.target as Node)) close();
    };
    const onResize = () => close();
    document.addEventListener("mousedown", outside);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, shown.length, searchable, options]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <>
      <span className="relative block" onKeyDown={searchable ? undefined : onKey}>
        <button
          ref={trigger}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={id}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onClick={() => {
            setActive(0);
            setQuery("");
            setOpen((o) => !o);
          }}
          className="field flex h-10 w-full items-center px-3 pr-8 text-left text-sm disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className={`min-w-0 flex-1 truncate ${display ? "" : "text-muted"}`} title={display || undefined}>
            {display || emptyLabel}
          </span>
        </button>
        <svg
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        >
          <path d="m5 8 5 5 5-5" />
        </svg>
      </span>
      <div
        ref={panel}
        id={id}
        popover="manual"
        onKeyDown={onKey}
        className="anim-menu-in m-0 flex max-h-72 flex-col overflow-hidden rounded-xl border border-border bg-surface p-0 text-sm text-foreground shadow-lg"
        style={{ position: "fixed", inset: "auto" }}
      >
        {searchable && (
          <div className="shrink-0 border-b border-border p-2">
            <input
              ref={search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder={allowCustom ? "Type or choose…" : multi ? "Search team members…" : "Search…"}
              aria-label={`Search: ${ariaLabel}`}
              aria-controls={id}
              autoComplete="off"
              className="field h-9 w-full px-3 text-sm placeholder:text-muted"
            />
          </div>
        )}
        <ul role="listbox" aria-multiselectable={multi || undefined} aria-label={ariaLabel} className="max-h-48 min-h-0 flex-1 overflow-y-auto p-1">
          {shown.length === 0 && !customRow && <li className="px-3 py-2 text-sm text-muted">{options.length === 0 ? "Nothing to choose from yet." : "No matches."}</li>}
          {rows.map((row, i) => {
            if (row.kind === "create") return null;
            const label = row.kind === "none" ? emptyLabel : row.kind === "custom" ? `Use “${row.text}”` : row.o.label;
            const on = row.kind === "none" ? selected.length === 0 : row.kind === "option" ? selected.includes(row.o.value) : false;
            return (
              <li key={row.kind === "option" ? row.o.value : row.kind} role="option" aria-selected={on}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-accent ${i === active ? "bg-hover" : ""} ${
                    row.kind === "custom" || (on && row.kind === "option") ? "font-medium text-accent" : row.kind === "none" ? "text-muted" : ""
                  }`}
                >
                  <span className="min-w-0 truncate">{label}</span>
                  {on && row.kind === "option" ? <span className="shrink-0 text-xs">✓</span> : row.kind === "option" && row.o.hint ? <span className="shrink-0 text-xs text-muted">{row.o.hint}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {onCreate && createLabel && (
          <div className="shrink-0 border-t border-border p-1">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(rows.length - 1)}
              onClick={() => choose(rows.length - 1)}
              className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent ${active === rows.length - 1 ? "bg-hover" : ""}`}
            >
              {createLabel}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
