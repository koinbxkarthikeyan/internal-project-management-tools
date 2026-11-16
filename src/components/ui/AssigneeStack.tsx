"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useItemDetailStore } from "@/stores/itemDetailStore";
import type { BacklogItemData } from "@/types/backlog";

export type Assignee = { name: string; team?: string };

/** The people in an assignees string ("Mayil, Sasi"), each with the team their profile says. */
export const assigneePeople = (names: string | undefined, users: readonly { name: string; team?: string | null }[]): Assignee[] =>
  (names ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({ name, team: users.find((u) => u.name.toLowerCase() === name.toLowerCase())?.team || undefined }));

/**
 * The people on a task. The list the table loads may not carry them (only the task's own detail does), so when the row has none, they are looked up by user id, and failing that read
 * from the task's detail (shared and kept for a minute, so each task is asked for once). A task that really has nobody stays empty.
 */
function useTaskAssignees(item: Pick<BacklogItemData, "id" | "assignees" | "assigneeIds">): Assignee[] {
  const users = useUsers();
  const [fromDetail, setFromDetail] = useState<string>();
  const byId = (item.assigneeIds ?? []).map((id) => users.find((u) => u.id === String(id))?.name).filter(Boolean).join(", ");
  const listed = item.assignees || byId;
  useEffect(() => {
    if (listed) return;
    let live = true;
    useItemDetailStore.getState().get(item.id).then((d) => live && setFromDetail(d.assignees || ""), () => {});
    return () => {
      live = false;
    };
  }, [item.id, listed]);
  return assigneePeople(listed || fromDetail, users);
}

// Every person gets their own hue: the golden angle between one person and the next keeps any number of people apart, and the same person always keeps the same colour
// (their place in the team list; a name that is not in the list gets a hue from the name itself).
const GOLDEN = 137.508;
const hueFor = (name: string, order: readonly string[]) => {
  const at = order.indexOf(name.toLowerCase());
  const n = at >= 0 ? at : [...name].reduce((sum, c) => sum * 31 + c.charCodeAt(0), 7) % 360;
  return (n * GOLDEN) % 360;
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

function Avatar({ name, size, hue }: { name: string; size: number; hue: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-surface"
      style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: `hsl(${hue.toFixed(0)} 58% 42%)`, color: "#fff" }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/**
 * The people on a task as overlapping round initials (the first few, then "+n"). Hovering, focusing or clicking the group opens a small card listing every person with their team; a
 * click outside it or Esc closes it. The card is drawn on the page itself, so a table's own scrolling can't cut it off. `passive` is for a place that is itself a button (a whole
 * clickable row): no button of its own, the card opens on hover only and a click goes to the row.
 */
export default function AssigneeStack({ people, size = 26, max = 3, passive = false, hideEmpty = false }: { people: readonly Assignee[]; size?: number; max?: number; passive?: boolean; hideEmpty?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const users = useUsers();
  const order = useMemo(() => [...users].sort((x, y) => String(x.id).localeCompare(String(y.id), undefined, { numeric: true })).map((u) => u.name.toLowerCase()), [users]);
  const hue = (name: string) => hueFor(name, order);
  const visible = open || hover;

  // The card sits under the avatars, or above them when there is no room below, and stays inside the window.
  useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect();
      const h = card.current?.offsetHeight ?? 0;
      const w = card.current?.offsetWidth ?? 0;
      if (!r) return;
      const below = r.bottom + 6 + h <= window.innerHeight - 8;
      setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - h) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [visible, people.length]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && !card.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (people.length === 0) return hideEmpty ? null : <span className="text-muted">Unassigned</span>;
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  const stack = (
    <>
      {shown.map((p, i) => (
        <span key={p.name} className={i > 0 ? "-ml-2" : ""}>
          <Avatar name={p.name} size={size} hue={hue(p.name)} />
        </span>
      ))}
      {more > 0 && (
        <span className="-ml-2 flex shrink-0 items-center justify-center rounded-full bg-hover text-[11px] font-semibold text-muted ring-2 ring-surface" style={{ width: size, height: size }}>
          +{more}
        </span>
      )}
    </>
  );
  return (
    <span ref={box} className="relative inline-flex" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {passive ? (
        <span className="inline-flex items-center" title={people.map((p) => p.name).join(", ")}>
          {stack}
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => (e.stopPropagation(), setOpen((o) => !o))}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
          aria-expanded={visible}
          aria-label={`${people.length} ${people.length === 1 ? "person" : "people"}: ${people.map((p) => p.name).join(", ")}`}
          className="inline-flex items-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
        >
          {stack}
        </button>
      )}
      {visible &&
        createPortal(
          <span
            ref={card}
            role="dialog"
            aria-label="Assignees"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", left: at?.left ?? 0, top: at?.top ?? 0, visibility: at ? "visible" : "hidden" }}
            className="anim-menu-in z-50 flex min-w-48 max-w-xs flex-col gap-1.5 rounded-xl border border-border bg-surface p-2.5 text-sm shadow-menu"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Assignees ({people.length})</span>
            {people.map((p) => (
              <span key={p.name} className="flex items-center gap-2">
                <Avatar name={p.name} size={22} hue={hue(p.name)} />
                <span className="min-w-0 truncate">{p.name}</span>
                {p.team && <span className="ml-auto shrink-0 rounded-full bg-hover px-2 py-0.5 text-[11px] text-muted">{p.team}</span>}
              </span>
            ))}
          </span>,
          document.body,
        )}
    </span>
  );
}

/** The assignees of one task, as the overlapping initials (see `useTaskAssignees` for where the people come from). */
export function TaskAssignees({ item, ...rest }: { item: Pick<BacklogItemData, "id" | "assignees" | "assigneeIds"> } & Omit<Parameters<typeof AssigneeStack>[0], "people">) {
  return <AssigneeStack people={useTaskAssignees(item)} {...rest} />;
}
