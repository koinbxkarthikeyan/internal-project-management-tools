"use client";

import ActionsMenu from "@/components/ui/ActionsMenu";
import { EditIcon, EyeIcon, EyeOffIcon, PlusIcon } from "@/components/ui/icons";
import type { Sprint } from "@/types/backlog";
import type { Pod } from "@/types/work";
import { useBacklog } from "../context/BacklogContext";

type SprintPodsProps = {
  sprint: Sprint;
  onAdd: (sprint: Sprint) => void;
  onView: (pod: Pod) => void;
  onEdit: (pod: Pod) => void;
  onHide: (pod: Pod) => void;
};

/** The PODs of one sprint, each with View, Edit and Hide, and (while the sprint runs) + Add POD. */
export default function SprintPods({ sprint, onAdd, onView, onEdit, onHide }: SprintPodsProps) {
  const { pods } = useBacklog();
  const list = (sprint.podIds ?? []).flatMap((id) => pods.filter((p) => p.id === id));

  return (
    <div aria-label={`PODs in ${sprint.name}`} className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">PODs</span>
      {list.length === 0 && <span className="text-xs text-muted">None yet</span>}
      {list.map((pod) => (
        <span key={pod.id} className="inline-flex items-center gap-1 rounded-full border border-border py-0.5 pl-2.5 pr-1 text-xs">
          {pod.name}
          <span className="text-muted">
            <ActionsMenu
              label={`Actions for ${pod.name}`}
              actions={[
                { key: "view", label: "View", icon: <EyeIcon />, onSelect: () => onView(pod) },
                { key: "edit", label: "Edit", icon: <EditIcon />, onSelect: () => onEdit(pod) },
                { key: "hide", label: "Hide", icon: <EyeOffIcon />, onSelect: () => onHide(pod) },
              ]}
            />
          </span>
        </span>
      ))}
      {sprint.status === "Active" && (
        <button
          type="button"
          onClick={() => onAdd(sprint)}
          aria-label={`Add POD to ${sprint.name}`}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-hover hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          <PlusIcon width={14} height={14} />
          Add POD
        </button>
      )}
    </div>
  );
}
