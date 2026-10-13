"use client";

import { useRef, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import PageSkeleton from "@/components/layout/PageSkeleton";
import ActionsMenu from "@/components/ui/ActionsMenu";
import EmptyState from "@/components/ui/EmptyState";
import { EditIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import ConfirmDeleteDrawer from "@/features/backlog/components/ConfirmDeleteDrawer";
import { initials } from "@/features/backlog/utils";
import { getErrorMessage } from "@/lib/apiClient";
import * as userService from "@/services/userService";
import type { AppUser } from "@/types/auth";
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
  // The Super Admin account is listed only for the signed-in Super Admin; for everyone else the list is filtered (records are untouched).
  const users = isSuperAdmin ? allUsers : allUsers.filter((u) => u.role !== "Super Admin");
  const toast = useToast();
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const [adding, setAdding] = useState(false);
  // Accounts whose Enable / Disable is being saved, so a double click can't send it twice.
  const toggling = useRef(new Set<string>());

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Users" />
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
        <PageHeader title="Users" />
        <section role="alert" className="rounded-2xl border border-border bg-surface">
          <EmptyState
            title="Couldn't load users"
            description={error}
            action={
              <button
                type="button"
                onClick={retry}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent"
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
        title="Users"
        description="Only registered users can sign in, and nobody can sign up. Enabled Admins can use the whole application and add team members; only the Super Admin can edit, delete or disable other accounts. Users and Disabled Admins can only open My sprint, My Task and Settings; a Disabled User can only open Settings."
        actions={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <PlusIcon />
            Add Team Member
          </button>
        }
      />

      <section className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Users and their access status</caption>
          <thead>
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
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              const style = STATUS_STYLE[u.status];
              return (
                <tr key={u.id} className="transition-colors hover:bg-hover">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
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
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3 text-muted">{u.team ?? "–"}</td>
                  <td className="px-4 py-3">
                    <span className={`${pill} ${style.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{u.lastLoginAt ? dateFormat.format(new Date(u.lastLoginAt)) : "–"}</td>
                  <td className="px-4 py-3">
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
                                        await userService.setUserAccess(u.id, next);
                                        await reload();
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
        {users.length === 0 && (
          <EmptyState compact title="No users yet" description="Use Add Team Member to register the first one." />
        )}
      </section>

      {adding && <UserFormDrawer canSetStatus={isSuperAdmin} onSaved={reload} onClose={() => setAdding(false)} />}
      {editing && <UserFormDrawer key={editing.id} user={editing} canSetStatus={isSuperAdmin} isSelf={editing.id === me?.id} onSaved={reload} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDeleteDrawer
          key={deleting.id}
          title="Delete user"
          name={`${deleting.name} (${deleting.email})`}
          consequence="They will be signed out and will no longer be able to sign in."
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await userService.deleteUser(deleting.id);
            } catch (err) {
              toast.show(getErrorMessage(err), "danger");
              return false;
            }
            await reload();
            toast.show(`${deleting.name} deleted`, "danger");
          }}
        />
      )}
    </div>
  );
}
