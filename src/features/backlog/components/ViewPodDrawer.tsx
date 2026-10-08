"use client";

import type { Pod } from "@/types/work";
import { useBacklog } from "../context/BacklogContext";
import BacklogDrawer from "./BacklogDrawer";

/** Read-only details of a POD: the sprints it is in and its tasks. */
export default function ViewPodDrawer({ pod, onClose }: { pod: Pod; onClose: () => void }) {
  const { sprints, items } = useBacklog();
  const inSprints = sprints.filter((s) => s.podIds?.includes(pod.id));
  const tasks = items.filter((i) => i.podId === pod.id);

  return (
    <BacklogDrawer heading="POD details" submitLabel="Close" onSubmit={() => {}} onClose={onClose} compact>
      <div className="flex flex-col gap-4 text-sm">
        <div>
          <p className="text-xs font-medium text-muted">POD name</p>
          <p className="mt-1 font-medium">{pod.name}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Sprints ({inSprints.length})</p>
          {inSprints.length === 0 ? (
            <p className="mt-1 text-muted">Not in any sprint yet.</p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-2">
              {inSprints.map((s) => (
                <li key={s.id} className="rounded-full border border-border px-2.5 py-0.5 text-xs">
                  {s.name} · {s.status}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Tasks ({tasks.length})</p>
          {tasks.length === 0 ? (
            <p className="mt-1 text-muted">No tasks in this POD yet.</p>
          ) : (
            <ul className="mt-1 divide-y divide-border rounded-xl border border-border">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted">{t.sprint}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </BacklogDrawer>
  );
}
