"use client";

import { useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useWorkStore } from "@/stores/workStore";
import { formatHours } from "../utils";

/** The time logged on one task, from the shared work entries (the same ones My Sprint and Your Logged Work use): the total and each person's share. */
export default function TaskLoggedHours({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const entries = useWorkStore((s) => s.entries);
  useEffect(() => {
    useWorkStore.getState().load(user?.id ?? "").catch(() => undefined);
  }, [user?.id]);

  const mine = entries.filter((e) => e.itemIds?.includes(taskId));
  const byPerson = new Map<string, number>();
  for (const e of mine) byPerson.set(e.person, (byPerson.get(e.person) ?? 0) + e.hours);
  const total = mine.reduce((sum, e) => sum + e.hours, 0);

  return (
    <div>
      <p className="text-xs font-medium text-muted">Logged hours</p>
      {mine.length === 0 ? (
        <p className="mt-1 text-sm text-muted">No time logged on this task yet.</p>
      ) : (
        <div className="mt-1 text-sm">
          <p>
            <span className="font-semibold tabular-nums">{formatHours(total)}</span> logged in total
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
            {[...byPerson].map(([person, hours]) => (
              <li key={person} className="flex justify-between gap-3">
                <span className="truncate">{person}</span>
                <span className="tabular-nums">{formatHours(hours)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
