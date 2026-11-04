"use client";

import { StatusBadge } from "@/components/ui/Badge";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { descendantsOf } from "@/features/backlog/hierarchy";
import { useWorkStore } from "@/stores/workStore";
import type { BacklogItemData } from "@/types/backlog";
import { formatHours } from "../utils";

/** Where a task sits in Backlog task, Bug, Ticket: the task it belongs to, the Bugs or Tickets under it, and the hours of all of them together. */
export default function TaskFamily({ item, skipTickets = false }: { item: BacklogItemData; /** Leave the Tickets out of the list (they are shown by their own block). */ skipTickets?: boolean }) {
  const { items, hiddenItems } = useBacklog();
  const entries = useWorkStore((s) => s.entries);
  const everything = [...items, ...hiddenItems];
  const parent = item.parent ? everything.find((i) => i.id === item.parent) : undefined;
  const below = descendantsOf(item.id, everything);
  if (!parent && below.length === 0) return null;
  if (!parent && skipTickets && below.every((c) => c.type === "Ticket")) return null;

  const direct = below.filter((c) => c.parent === item.id && !(skipTickets && c.type === "Ticket"));
  const hoursOn = (codes: string[]) => entries.filter((e) => e.itemIds?.some((id) => codes.includes(id))).reduce((sum, e) => sum + e.hours, 0);
  const own = hoursOn([item.id]);
  const all = hoursOn([item.id, ...below.map((c) => c.id)]);
  const done = below.filter((c) => c.status === "Done").length;

  return (
    <div className="flex flex-col gap-3">
      {parent && (
        <div>
          <p className="text-xs font-medium text-muted">Belongs to</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-xs text-muted">{parent.id}</span>
            <span className="font-semibold">{parent.title}</span>
            {parent.type && <span className="text-xs text-muted">{parent.type}</span>}
            <StatusBadge status={parent.status} />
          </p>
        </div>
      )}
      {direct.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted">
            {direct.every((c) => c.type === "Ticket") ? "Tickets" : direct.every((c) => c.type === "Bug") ? "Bugs" : "Bugs and Tickets"} under this task · {done} of {below.length} done
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {direct.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-xs text-muted">{c.id}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                <StatusBadge status={c.status} />
                {descendantsOf(c.id, everything).length > 0 && <span className="text-xs text-muted">{descendantsOf(c.id, everything).length} below</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Hours: <span className="font-semibold tabular-nums text-foreground">{formatHours(all)}</span> including everything below, of which {formatHours(own)} on this task itself.
          </p>
        </div>
      )}
    </div>
  );
}
