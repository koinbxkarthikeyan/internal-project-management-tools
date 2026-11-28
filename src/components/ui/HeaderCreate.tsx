"use client";

import { PlusIcon } from "@/components/ui/icons";

/**
 * The main "create" button of a page header (Create backlog, Plan New Sprint, Add Team Member, Create Owner). From tablet up it has its words; on a phone or small
 * tablet (under 768px) it shrinks to a square "+" so the title keeps its room, and a small label bubble under it says what it does (on hover, and when it has the keyboard focus).
 * `keyHint` is the shortcut letter shown beside the words on a wide screen.
 */
export default function HeaderCreate({ label, onClick, keyHint, ...rest }: { label: string; onClick: () => void; keyHint?: string; "aria-keyshortcuts"?: string }) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        aria-keyshortcuts={rest["aria-keyshortcuts"] ?? keyHint}
        className="btn-brand inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-md:w-10 max-md:px-0"
      >
        <PlusIcon />
        <span className="max-md:sr-only">
          {label}
          {keyHint && <kbd className="ml-2 hidden rounded border border-current/30 px-1.5 text-[10px] font-medium opacity-80 lg:inline">{keyHint}</kbd>}
        </span>
      </button>
      <span
        role="tooltip"
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-full z-30 mt-1.5 hidden whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-menu max-md:group-hover/tip:block max-md:group-focus-within/tip:block"
      >
        {label}
      </span>
    </span>
  );
}
