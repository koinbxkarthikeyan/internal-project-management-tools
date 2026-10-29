"use client";

import { useRef, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import ActionsMenu from "@/components/ui/ActionsMenu";
import EmptyState from "@/components/ui/EmptyState";
import { SearchableSelect } from "@/components/ui/FormControls";
import { EditIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import BacklogSearch from "@/features/backlog/components/BacklogSearch";
import ConfirmDeleteDrawer from "@/features/backlog/components/ConfirmDeleteDrawer";
import { initials } from "@/features/backlog/utils";
import { getErrorMessage } from "@/lib/apiClient";
import * as userService from "@/services/userService";
import type { AppUser } from "@/types/auth";
import { useUsersStore } from "@/stores/usersStore";
import { useManagedUsers } from "../hooks/useManagedUsers";
import UserFormDrawer from "./UserFormDrawer";

const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";
const STATUS_STYLE = {
  Enabled: { pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500" },
  Disabled: { pill: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300", dot: "bg-slate-400" },
} as const;

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** Registered users (Admin-managed), loaded from and saved to the backend. */
export default function UsersPage() {
  const { user: me, isAdmin, isSuperAdmin } = useAuth();
  const { status, error, users: allUsers, reload, retry } = useManagedUsers(isAdmin);
  const { setManaged } = useUsersStore.getState();
  // The Super Admin account is listed only for the signed-in Super Admin; for everyone else the list is filtered (records are untouched).
  const users = isSuperAdmin ? allUsers : allUsers.filter((u) => u.role !== "Super Admin");
  const toast = useToast();
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const [adding, setAdding] = useState(false);
  // Search (name, email, team) and filters (team, role, access status); they only narrow what is listed.
  const [filters, setFilters] = useState({ query: "", team: "", role: "", status: "" });
  const hasFilters = Object.values(filters).some(Boolean);
  const q = filters.query.trim().toLowerCase();
  const shown = users.filter(
    (u) =>
      (!q || [u.name, u.email, u.team ?? ""].some((v) => v.toLowerCase().includes(q))) &&
      (!filters.team || u.team === filters.team) &&
      (!filters.role || u.role === filters.role) &&
      (!filters.status || u.status === filters.status),
  );
  const teamChoices = [...new Set(users.map((u) => u.team).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b));
  const roleChoices = (["Super Admin", "Admin", "User"] as const).filter((r) => users.some((u) => u.role === r));
  // Accounts whose Enable / Disable is being saved, so a double click can't send it twice.
  const toggling = useRef(new Set<string>());

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Team Members" />
        <section className="rounded-2xl border border-border bg-surface">
          <EmptyState title="Admins only" description="Only an Admin can manage users. Ask an administrator if you need access changed." />
        </section>
      </div>
    );
  }

  if (status === "loading") return <PageSkeleton />;

  if (status === "error") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Team Members" />
        <section role="alert" className="rounded-2xl border border-border bg-surface">
          <EmptyState
            title="Couldn't load users"
            description={error}
            action={
              <button
                type="button"
                onClick={retry}
                className="rounded-xl btn-brand px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent"
              >
                Try again
              </button>
            }
          />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team Members"
        description="Only registered users can sign in, and nobody can sign up. Enabled Admins can use the whole application and add team members; only the Super Admin can edit, delete or disable other accounts. Users and Disabled Admins can only open My sprint, My Task and Settings; a Disabled User can only open Settings."
        actions={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-xl btn-brand px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <PlusIcon />
            Add Team Member
          </button>
        }
      />

      <section aria-label="Search and filters" className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-2.5">
        <BacklogSearch value={filters.query} onChange={(query) => setFilters({ ...filters, query })} placeholder="Search name, email or team…" ariaLabel="Search team members" />
        <SearchableSelect ariaLabel="Filter by team" value={filters.team} onChange={(team) => setFilters({ ...filters, team })} options={teamChoices} placeholder="Team: All" className="min-w-0 flex-1 basis-32 sm:flex-none sm:basis-40" />
        <SearchableSelect ariaLabel="Filter by role" value={filters.role} onChange={(role) => setFilters({ ...filters, role })} options={roleChoices} placeholder="Role: All" className="min-w-0 flex-1 basis-32 sm:flex-none sm:basis-40" />
        <SearchableSelect ariaLabel="Filter by access status" value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={["Enabled", "Disabled"]} placeholder="Access: All" className="min-w-0 flex-1 basis-32 sm:flex-none sm:basis-40" />
        {hasFilters && (
          <button type="button" onClick={() => setFilters({ query: "", team: "", role: "", status: "" })} className="h-10 rounded-lg px-3 text-sm font-medium text-accent transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
            Clear
          </button>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        {/* About 10 rows are visible; the rest scroll inside, with the header kept in view. */}
        <div className="rt-box"><div className="table-scroll" style={{ "--row-h": "3.05rem" } as React.CSSProperties}>
        <table className="rt w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Users and their access status</caption>
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border bg-background/60 text-xs font-medium uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-2.5 text-left">Name</th>
              <th scope="col" className="px-4 py-2.5 text-left">Email</th>
              <th scope="col" className="px-4 py-2.5 text-left">Team</th>
              <th scope="col" className="px-4 py-2.5 text-left">Access Status</th>
              <th scope="col" className="px-4 py-2.5 text-left">Last sign-in</th>
              <th scope="col" className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map((u) => {
              const isSelf = u.id === me?.id;
              const style = STATUS_STYLE[u.status];
              return (
                <tr key={u.id} className="transition-colors duration-150 hover:bg-row-hover">
                  <th scope="row" data-primary className="px-4 py-2 text-left font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent"
                        aria-hidden="true"
                      >
                        {initials(u.name)}
                      </span>
                      <span className="truncate">{u.name}</span>
                      {isSelf && <span className="text-xs font-normal text-muted">(you)</span>}
                    </span>
                  </th>
                  <td data-label="Email" className="px-4 py-2 text-muted">{u.email}</td>
                  <td data-label="Team" className="px-4 py-2 text-muted">{u.team ?? "–"}</td>
                  <td data-label="Access Status" className="px-4 py-2">
                    <span className={`${pill} ${style.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
                      {u.status}
                    </span>
                  </td>
                  <td data-label="Last sign-in" className="px-4 py-2 text-muted">{u.lastLoginAt ? dateFormat.format(new Date(u.lastLoginAt)) : "–"}</td>
                  <td data-actions className="px-4 py-2">
                    <div className="flex justify-end text-muted">
                      {u.role === "Super Admin" && !isSuperAdmin ? (
                        <span className="px-2 text-xs" title="Only the Super Admin can change this account">Protected</span>
                      ) : !isSuperAdmin && !isSelf ? (
                        // An Admin can add users but not edit or delete other users; that is for the Super Admin.
                        <span className="px-2 text-xs" title="Only the Super Admin can edit or delete other users">–</span>
                      ) : (
                        <ActionsMenu
                          label={`Actions for ${u.name}`}
                          actions={[
                            { key: "edit", label: "Edit", icon: <EditIcon />, onSelect: () => setEditing(u) },
                            // What can be done to a user depends on their role: a Super Admin can only be edited; only the Super Admin can disable / enable an Admin;
                            // Admins and normal Users can be edited and deleted.
                            // Your own access can't be switched off or deleted while you're signed in.
                            ...(isSelf || u.role === "Super Admin"
                              ? []
                              : [
                                  ...(u.role === "Admin" && isSuperAdmin
                                    ? [
                                  {
                                    key: "toggle",
                                    label: u.status === "Enabled" ? "Disable access" : "Enable access",
                                    icon: u.status === "Enabled" ? <EyeOffIcon /> : <EyeIcon />,
                                    onSelect: async () => {
                                      if (toggling.current.has(u.id)) return;
                                      toggling.current.add(u.id);
                                      const next = u.status === "Enabled" ? "Disabled" : "Enabled";
                                      try {
                                        const saved = await userService.setUserAccess(u.id, next);
                                        setManaged((list) => list.map((x) => (x.id === u.id ? { ...x, status: saved.status } : x)));
                                        toast.show(
                                          next === "Enabled" ? `${u.name} enabled` : `${u.name} disabled (My sprint and My Task only)`,
                                          next === "Enabled" ? "success" : "info",
                                        );
                                      } catch (err) {
                                        toast.show(getErrorMessage(err), "danger");
                                      } finally {
                                        toggling.current.delete(u.id);
                                      }
                                    },
                                  },
                                      ]
                                    : []),
                                  { key: "delete", label: "Delete", icon: <TrashIcon />, danger: true, onSelect: () => setDeleting(u) },
                                ]),
                          ]}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
</div>
        {users.length === 0 && (
          <EmptyState compact title="No users yet" description="Use Add Team Member to register the first one." />
        )}
        {users.length > 0 && shown.length === 0 && <EmptyState compact title="No matching team members" description="Try changing your search or filters." />}
      </section>

      {adding && <UserFormDrawer canSetStatus={isSuperAdmin} onSaved={reload} onClose={() => setAdding(false)} />}
      {editing && <UserFormDrawer key={editing.id} user={editing} canSetStatus={isSuperAdmin} isSelf={editing.id === me?.id} onSaved={reload} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDeleteDrawer
          key={deleting.id}
          title="Delete user"
          name={`${deleting.name} (${deleting.email})`}
          consequence="They are signed out and can no longer sign in."
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await userService.deleteUser(deleting.id);
            } catch (err) {
              toast.show(getErrorMessage(err), "danger");
              return false;
            }
            setManaged((list) => list.filter((x) => x.id !== deleting.id));
            toast.show(`${deleting.name} deleted`, "delete");
          }}
        />
      )}
    </div>
  );
}
