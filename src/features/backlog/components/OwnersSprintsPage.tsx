"use client";

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { SearchableSelect } from "@/components/ui/FormControls";
import { PlusIcon } from "@/components/ui/icons";
import ActionsMenu from "@/components/ui/ActionsMenu";
import { EditIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import BacklogSearch from "./BacklogSearch";
import ConfirmDeleteDrawer from "./ConfirmDeleteDrawer";
import CreateOwnerDrawer from "./CreateOwnerDrawer";
import EditOwnerDrawer from "./EditOwnerDrawer";
import { useBacklog } from "../context/BacklogContext";
import { initials } from "../utils";
import { describeOwner } from "../ownerGroups";
import { recentSprints } from "@/features/work/utils";
import { sprintLabel } from "@/constants/backlog-options";

export default function OwnersSprintsPage() {
  const { items, owners, ownerRecords, sprints, sprintNames: allSprintNames, deleteOwner } = useBacklog();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editingOwner, setEditingOwner] = useState<string | null>(null);
  const [deletingOwner, setDeletingOwner] = useState<string | null>(null);
  // Search (name, role, team) and filters (team, role); they only narrow what is listed.
  const [filters, setFilters] = useState({ query: "", team: "", role: "" });
  const hasFilters = Object.values(filters).some(Boolean);
  // Which sprints the table covers: the running sprint (the default), the two most recent closed sprints before it, or all of them.
  const [scope, setScope] = useState<"active" | "previous" | "all">("active");
  const dated = (list: readonly { name: string; id: string; start?: string; end?: string; status?: string }[]) =>
    list.flatMap((s) => (s.name !== "Unplanned" && s.start && s.end ? [{ ...s, start: s.start, end: s.end }] : []));
  const sprintNames =
    scope === "all"
      ? allSprintNames
      : scope === "active"
        ? sprints.filter((s) => s.name !== "Unplanned" && s.status === "Active").map((s) => s.name)
        : recentSprints(dated(sprints.filter((s) => s.status === "Closed")))
            .slice(-2)
            .map((s) => s.name);
  const recordOf = (name: string) => ownerRecords.find((o) => o.name === name);
  const q = filters.query.trim().toLowerCase();
  const shownOwners = owners.filter((name) => {
    const r = recordOf(name);
    return (
      (!q || [name, r?.role ?? "", r?.team ?? ""].some((v) => v.toLowerCase().includes(q))) &&
      (!filters.team || r?.team === filters.team) &&
      (!filters.role || r?.role === filters.role)
    );
  });
  const teamChoices = [...new Set(ownerRecords.map((o) => o.team).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b));
  const roleChoices = [...new Set(ownerRecords.map((o) => o.role).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b));
  // One owner's tasks in one sprint, or (no sprint given) in every sprint the table covers.
  const count = (owner: string, sprint?: string) => items.filter((i) => i.owner === owner && (sprint ? i.sprint === sprint : sprintNames.includes(i.sprint))).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Owners & sprints"
        description={`How work is distributed across ${owners.length} owners and ${allSprintNames.length} sprints.`}
        // Owners are their own records, separate from users; only Admins manage them.
        actions={
          isAdmin ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 rounded-xl btn-brand px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <PlusIcon />
              Create Owner
            </button>
          ) : undefined
        }
      />
      <section aria-label="Search and filters" className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-2.5">
        <BacklogSearch value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Search name, role or team…" ariaLabel="Search owners" />
        <SearchableSelect
          ariaLabel="Sprints shown"
          required
          value={scope}
          onChange={(v) => setScope(v === "previous" || v === "all" ? v : "active")}
          options={[
            { value: "active", label: "Active Sprint" },
            { value: "previous", label: "Previous 2 Sprints" },
            { value: "all", label: "All" },
          ]}
          className="min-w-0 flex-1 basis-40 sm:flex-none sm:basis-48"
        />
        <SearchableSelect ariaLabel="Filter by team" value={filters.team} onChange={(team) => setFilters({ ...filters, team })} options={teamChoices} placeholder="Team: All" className="min-w-0 flex-1 basis-32 sm:flex-none sm:basis-40" />
        <SearchableSelect ariaLabel="Filter by role" value={filters.role} onChange={(role) => setFilters({ ...filters, role })} options={roleChoices} placeholder="Role: All" className="min-w-0 flex-1 basis-32 sm:flex-none sm:basis-40" />
        {hasFilters && (
          <button type="button" onClick={() => setFilters({ query: "", team: "", role: "" })} className="h-10 rounded-lg px-3 text-sm font-medium text-accent transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
            Clear
          </button>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        {/* About 10 rows are visible; the rest scroll inside, with the header kept in view. */}
        <div className="table-scroll" style={{ "--row-h": "3.3rem" } as React.CSSProperties}>
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">Number of items per owner and sprint</caption>
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-2.5 text-left">Owner</th>
              {sprintNames.map((s) => (
                <th key={s} scope="col" className="px-4 py-2.5 text-center">{sprintLabel(s)}</th>
              ))}
              <th scope="col" className="px-4 py-2.5 text-center">Total</th>
              {isAdmin && <th scope="col" className="px-4 py-2.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shownOwners.map((owner) => (
              <tr key={owner} className="transition-colors duration-150 hover:bg-row-hover">
                <th scope="row" className="px-4 py-2 text-left font-medium">
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
                  <td key={s} className="px-4 py-2 text-center tabular-nums text-muted">
                    {count(owner, s) || "–"}
                  </td>
                ))}
                <td className="px-4 py-2 text-center font-medium tabular-nums">{count(owner)}</td>
                {isAdmin && (
                  <td className="px-4 py-2">
                    {owner !== "Unassigned" && (
                      <div className="flex justify-end text-muted">
                        <ActionsMenu
                          label={`Actions for ${owner}`}
                          actions={[
                            { key: "edit", label: "Edit", icon: <EditIcon />, onSelect: () => setEditingOwner(owner) },
                            { key: "delete", label: "Delete", icon: <TrashIcon />, danger: true, onSelect: () => setDeletingOwner(owner) },
                          ]}
                        />
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {owners.length > 0 && shownOwners.length === 0 && <EmptyState compact title="No matching owners" description="Try changing your search or filters." />}
        {owners.every((o) => o === "Unassigned") && (
          <EmptyState compact title="No owners yet" description="Use Create Owner to add the first owner." />
        )}
      </section>
      {adding && <CreateOwnerDrawer showRole={false} onClose={() => setAdding(false)} />}
      {editingOwner && <EditOwnerDrawer key={editingOwner} owner={editingOwner} onClose={() => setEditingOwner(null)} />}
      {deletingOwner && (
        <ConfirmDeleteDrawer
          key={deletingOwner}
          title="Delete owner"
          name={deletingOwner}
          consequence={`Their ${count(deletingOwner)} ${count(deletingOwner) === 1 ? "item" : "items"} move to Unassigned.`}
          onClose={() => setDeletingOwner(null)}
          onConfirm={async () => {
            const owner = deletingOwner;
            const moved = await deleteOwner(owner);
            if (moved === null) return false;
            toast.show(
              moved > 0 ? `Owner ${owner} deleted; ${moved} ${moved === 1 ? "item" : "items"} moved to Unassigned` : `Owner ${owner} deleted`,
              "danger",
            );
          }}
        />
      )}
    </div>
  );
}
