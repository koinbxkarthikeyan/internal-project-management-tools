"use client";

import { useState } from "react";
import { useUsers } from "../hooks/useUsers";
import { PasswordField } from "@/components/ui/PasswordField";
import { checkNewPassword, generatePassword } from "@/lib/auth/passwordRules";
import { EmailField } from "@/components/ui/EmailInput";
import { ComboField, SelectField, TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/Toast";
import { ALLOWED_EMAIL_DOMAIN, DEFAULT_INITIAL_PASSWORD, TEAM_MAX_LENGTH, USER_ROLES } from "@/constants/auth";
import BacklogDrawer from "@/features/backlog/components/BacklogDrawer";
import { usersStore } from "@/lib/auth/userStore";
import { validateEmail } from "@/lib/auth/emailRules";
import { canonicalTeam, cleanTeam, isKnownTeam, teamOptions } from "@/lib/auth/teams";
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
  /** Called with the new user once it was created (used to pick them as an Owner straight away). */
  onCreated?: (user: AppUser) => void;
  /** Only the Super Admin can enable / disable an Admin account. */
  canSetStatus?: boolean;
  /** "+ Add Team Member" from a backlog form: registers a plain User with a random initial password, so Role and Password are not asked for. */
  ownerMode?: boolean;
  onClose: () => void;
};

const STATUSES: AccessStatus[] = ["Enabled", "Disabled"];

/** A User is always Enabled (a Disabled account can't sign in); an Admin keeps the status the Super Admin chose. */
/** "karthikeyan  kumar" -> "Karthikeyan Kumar": each word starts with a capital, spaces are single (a trailing space is kept while typing). */
const titleCase = (v: string) => v.replace(/\s{2,}/g, " ").replace(/^\s+/, "").replace(/(^|\s)(\S)/g, (_, space: string, c: string) => space + c.toUpperCase());

const defaultOrChosen = (role: AssignableRole, status: AccessStatus): AccessStatus => (role === "Admin" ? status : "Enabled");
const defaultStatus = (): AccessStatus => "Enabled";

/** Side panel for adding a team member (Admins only; there is no self-registration) or editing one. */
export default function UserFormDrawer({ user, isSelf = false, onSaved, onCreated, canSetStatus = false, ownerMode = false, onClose }: UserFormDrawerProps) {
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  function changeName(value: string) {
    setName(titleCase(value));
    setError("");
  }
  const isSuper = user?.role === "Super Admin";
  const [role, setRole] = useState<AssignableRole>(isSuper ? "Admin" : (user?.role as AssignableRole) ?? "User");
  // New accounts start Enabled. Only the Super Admin gets the Enable/Disable control, and only for Admin accounts.
  const [status, setStatus] = useState<AccessStatus>(user?.status ?? defaultStatus());
  // Teams already saved on users (plus the defaults), so a team added once is offered the next time too.
  const teams = teamOptions(useUsers());
  const [team, setTeam] = useState(user?.team ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const clear = <T,>(set: (v: T) => void) => (v: T) => (set(v), setError(""));


  async function submit() {
    const checked = validateEmail(email);
    if (!checked.ok) return setError(checked.message.replace("can sign in", "can be added")), false;
    const addr = checked.email;
    // Pick a team or type a new one; a name that matches an existing team (ignoring case and spacing) reuses it.
    if (cleanTeam(team).length > TEAM_MAX_LENGTH) return setError(`A team name can be at most ${TEAM_MAX_LENGTH} characters.`), false;
    const chosenTeam = cleanTeam(team) ? canonicalTeam(team, teams) : undefined;
    // A new account needs a password; when editing, a password is only validated if one is typed (it resets theirs).
    if (user && password) {
      const problem = checkNewPassword(password);
      if (problem) return setError(problem), false;
    }
    // A registered email can only be added once (and, for an owner, so can the name: the owner is picked by name).
    if (ownerMode && usersStore.read().some((u) => u.name.toLowerCase() === name.trim().toLowerCase())) return setError(`A user named ${name.trim()} already exists. Pick them from the Owner list.`), false;
    if (!user && usersStore.read().some((u) => u.email === addr)) return setError("A user with this email is already registered."), false;
    let createdUser: AppUser | undefined;
    try {
      if (user) {
        // The Super Admin can only be renamed or have their email changed (the backend enforces this too).
        await userService.updateUser(user.id, {
          name: name.trim() || user.name,
          email: addr,
          team: chosenTeam ?? null,
          ...(isSuper ? {} : { role, ...((role === "Admin" && canSetStatus) || role !== user.role ? { status: defaultOrChosen(role, status) } : {}) }),
          ...(password ? { password } : {}),
        });
        toast.show(`${name.trim() || user.name} updated`);
      } else {
        const created = (createdUser = await userService.createUser({ name: name.trim(), email: addr, role: ownerMode ? "User" : role, status: ownerMode ? "Enabled" : defaultOrChosen(role, status), ...(chosenTeam ? { team: chosenTeam } : {}), password: ownerMode ? generatePassword() : DEFAULT_INITIAL_PASSWORD }));
        toast.show(`${created.name ?? name.trim()} added`);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    }
    await onSaved?.();
    if (createdUser) onCreated?.(createdUser);
  }

  return (
    <BacklogDrawer heading={user ? "Edit user" : "Add Team Member"} submitLabel={user ? "Save user" : "Add Team Member"} compact onClose={onClose} onSubmit={submit}>
      <TextField label="Name" required value={name} onChange={changeName} placeholder="e.g. Jordan Blake" />
      <EmailField label="Email" required value={email} onChange={clear(setEmail)} placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`} />
      <ComboField label="Team" value={team} onChange={clear(setTeam)} suggestions={teams} placeholder="Search, select or type a new team" />
      {cleanTeam(team) && !isKnownTeam(team, teams) && <p className="-mt-2 text-xs text-muted">&ldquo;{cleanTeam(team)}&rdquo; is a new team. It will be added when you save.</p>}
      {!ownerMode && (
      <SelectField label="Role" value={isSuper ? "Super Admin" : role} onChange={(v) => (setRole(v as AssignableRole), setStatus(defaultStatus()))} options={isSuper ? ["Super Admin"] : isSelf ? [role] : USER_ROLES} />
      )}
      {!isSuper && role === "Admin" && canSetStatus && (
        <SelectField label="Access Status" value={status} onChange={(v) => setStatus(v as AccessStatus)} options={isSelf ? ["Enabled"] : STATUSES} />
      )}
      {/* Existing passwords are never shown; leaving this empty when editing keeps the current one. */}
      {/* New accounts always start with the fixed default password (read-only); editing can reset it. */}
      {!isSuper &&
        !ownerMode &&
        (user ? (
          <PasswordField label="Reset password (leave empty to keep the current one)" value={password} onChange={clear(setPassword)} placeholder="At least 8 characters" />
        ) : (
          <PasswordField label="Password" required readOnly value={DEFAULT_INITIAL_PASSWORD} onChange={() => {}} />
        ))}
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
