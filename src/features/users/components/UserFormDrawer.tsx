"use client";

import { useState } from "react";
import { ComboField, SelectField, TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { ALLOWED_EMAIL_DOMAIN, USER_ROLES, USER_TEAMS, type UserTeam } from "@/constants/auth";
import BacklogDrawer from "@/features/backlog/components/BacklogDrawer";
import { getErrorMessage } from "@/lib/apiClient";
import * as userService from "@/services/userService";
import type { AccessStatus, AppUser, AssignableRole } from "@/types/auth";

type UserFormDrawerProps = {
  /** The user being edited, or omitted to add a new one. */
  user?: AppUser;
  /** True when editing the signed-in user, who can't change their own role or disable themselves. */
  isSelf?: boolean;
  /** Called after the backend saved the change, so the list can reload. */
  onSaved?: () => void | Promise<void>;
  onClose: () => void;
};

const STATUSES: AccessStatus[] = ["Enabled", "Disabled"];

/** Side panel for adding a user (Admins only; there is no self-registration) or editing one. */
export default function UserFormDrawer({ user, isSelf = false, onSaved, onClose }: UserFormDrawerProps) {
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const isSuper = user?.role === "Super Admin";
  const [role, setRole] = useState<AssignableRole>(isSuper ? "Admin" : (user?.role as AssignableRole) ?? "User");
  const [status, setStatus] = useState<AccessStatus>(user?.status ?? "Enabled");
  const [team, setTeam] = useState(user?.team ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const clear = <T,>(set: (v: T) => void) => (v: T) => (set(v), setError(""));

  // Admins sign in with a password, so adding one needs it; when editing, leaving it empty keeps the current one.
  const needsPassword = !isSuper && role === "Admin";

  async function submit() {
    // The Team is picked from the fixed list (typing just filters it); leaving it empty is allowed.
    const chosenTeam = USER_TEAMS.find((t) => t.toLowerCase() === team.trim().toLowerCase());
    if (team.trim() && !chosenTeam) return setError(`Pick a Team from the list: ${USER_TEAMS.join(", ")}.`), false;
    if (!user && needsPassword && password.length < 8) return setError("Give the Admin a password of at least 8 characters."), false;
    try {
      if (user) {
        // The Super Admin can only be renamed or have their email changed (the backend enforces this too).
        await userService.updateUser(user.id, {
          name: name.trim() || user.name,
          email,
          team: (chosenTeam ?? null) as UserTeam | null,
          ...(isSuper ? {} : { role, ...(role === "Admin" ? { status } : {}) }),
          ...(needsPassword && password ? { password } : {}),
        });
        toast.show(`${name.trim() || user.name} updated`);
      } else {
        const created = await userService.createUser({ name: name.trim(), email, role, status: role === "Admin" ? status : "Enabled", ...(chosenTeam ? { team: chosenTeam } : {}), ...(needsPassword ? { password } : {}) });
        toast.show(`${created.name ?? name.trim()} added`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    }
    await onSaved?.();
  }

  return (
    <BacklogDrawer heading={user ? "Edit user" : "Add user"} submitLabel={user ? "Save user" : "Add user"} compact onClose={onClose} onSubmit={submit}>
      <TextField label="Name" required value={name} onChange={clear(setName)} placeholder="e.g. Jordan Blake" />
      <TextField label="Email" required value={email} onChange={clear(setEmail)} placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`} />
      <ComboField label="Team" value={team} onChange={clear(setTeam)} suggestions={USER_TEAMS} placeholder="Search or select a team" />
      <SelectField label="Role" value={isSuper ? "Super Admin" : role} onChange={(v) => setRole(v as AssignableRole)} options={isSuper ? ["Super Admin"] : isSelf ? [role] : USER_ROLES} />
      {/* Access controls are for Admins only; a normal User has none. */}
      {!isSuper && role === "Admin" && (
        <SelectField label="Access Status" value={status} onChange={(v) => setStatus(v as AccessStatus)} options={isSelf ? ["Enabled"] : STATUSES} />
      )}
      {/* A normal User has no access controls: the field is shown greyed out and stays Enabled. */}
      {!isSuper && role === "User" && <SelectField label="Access Status" value="Enabled" onChange={() => {}} options={["Enabled"]} disabled />}
      {needsPassword && (
        <TextField
          label={user ? "New password (leave empty to keep the current one)" : "Password"}
          type="password"
          required={!user}
          value={password}
          onChange={clear(setPassword)}
          placeholder="At least 8 characters"
        />
      )}
      {isSuper ? (
        <p className="-mt-2 text-xs text-muted">The Super Admin is the only one of its kind: the role and access can&apos;t be changed, and it can&apos;t be deleted.</p>
      ) : (
        isSelf && <p className="-mt-2 text-xs text-muted">You can&apos;t change your own role or disable your own access while signed in.</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
    </BacklogDrawer>
  );
}
