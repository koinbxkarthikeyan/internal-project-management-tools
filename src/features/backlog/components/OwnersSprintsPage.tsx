"use client";

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ActionsMenu from "@/components/ui/ActionsMenu";
import { EditIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { useBacklog } from "../context/BacklogContext";
import { initials } from "../utils";
import { describeOwner } from "../ownerGroups";
import CreateOwnerDrawer from "./CreateOwnerDrawer";
import ConfirmDeleteDrawer from "./ConfirmDeleteDrawer";
import EditOwnerDrawer from "./EditOwnerDrawer";

export default function OwnersSprintsPage() {
  const { items, owners, ownerRecords, sprintNames, deleteOwner } = useBacklog();
  const toast = useToast();
  const [editingOwner, setEditingOwner] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingOwner, setDeletingOwner] = useState<string | null>(null);
  const count = (owner: string, sprint?: string) =>
    items.filter((i) => i.owner === owner && (!sprint || i.sprint === sprint)).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Owners & sprints"
        description={`How work is distributed across ${owners.length} owners and ${sprintNames.length} sprints.`}
        actions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <PlusIcon />
            Create Owner
          </button>
        }
      />
      <section className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Number of items per owner and sprint</caption>
          <thead>
            <tr className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-2.5 text-left">Owner</th>
              {sprintNames.map((s) => (
                <th key={s} scope="col" className="px-4 py-2.5 text-center">{s}</th>
              ))}
              <th scope="col" className="px-4 py-2.5 text-center">Total</th>
              <th scope="col" className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {owners.map((owner) => (
              <tr key={owner} className="transition-colors hover:bg-hover">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  <span className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent"
                      aria-hidden="true"
                    >
                      {initials(owner)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      {owner}
                      {describeOwner(ownerRecords.find((o) => o.name === owner)) && (
                        <span className="truncate text-xs font-normal text-muted">
                          {describeOwner(ownerRecords.find((o) => o.name === owner))}
                        </span>
                      )}
                    </span>
                  </span>
                </th>
                {sprintNames.map((s) => (
                  <td key={s} className="px-4 py-3 text-center tabular-nums text-muted">
                    {count(owner, s) || "–"}
                  </td>
                ))}
                <td className="px-4 py-3 text-center font-medium tabular-nums">{count(owner)}</td>
                <td className="px-4 py-3">
                  {owner !== "Unassigned" && (
                    <div className="flex justify-end text-muted">
                      <ActionsMenu
                        label={`Actions for ${owner}`}
                        actions={[
                          { key: "edit", label: "Edit", icon: <EditIcon />, onSelect: () => setEditingOwner(owner) },
                          {
                            key: "delete",
                            label: "Delete",
                            icon: <TrashIcon />,
                            danger: true,
                            onSelect: () => setDeletingOwner(owner),
                          },
                        ]}
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {owners.every((o) => o === "Unassigned") && (
          <EmptyState compact title="No owners yet" description="Use Create Owner to add the first owner." />
        )}
      </section>
      {creating && <CreateOwnerDrawer showRole={false} onClose={() => setCreating(false)} />}
      {deletingOwner && (
        <ConfirmDeleteDrawer
          key={deletingOwner}
          title="Delete owner"
          name={deletingOwner}
          consequence={`Their ${count(deletingOwner)} ${count(deletingOwner) === 1 ? "item" : "items"} will be moved to Unassigned.`}
          onClose={() => setDeletingOwner(null)}
          onConfirm={async () => {
            const owner = deletingOwner;
            const moved = await deleteOwner(owner);
            if (moved === null) return false;
            toast.show(
              moved > 0
                ? `Owner ${owner} deleted; ${moved} ${moved === 1 ? "item" : "items"} moved to Unassigned`
                : `Owner ${owner} deleted`,
              "danger",
            );
          }}
        />
      )}
      {editingOwner && (
        <EditOwnerDrawer key={editingOwner} owner={editingOwner} onClose={() => setEditingOwner(null)} />
      )}
    </div>
  );
}
