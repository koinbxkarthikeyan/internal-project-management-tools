"use client";

import { useState, type FormEvent } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { EmailField } from "@/components/ui/EmailInput";
import { Field, TextField, controlClass } from "@/components/ui/FormControls";
import { PasswordField } from "@/components/ui/PasswordField";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getErrorMessage } from "@/lib/apiClient";
import { validateEmail } from "@/lib/auth/emailRules";
import { checkNewPassword } from "@/lib/auth/passwordRules";
import { sessionStore } from "@/lib/auth/sessionStore";
import { refreshUsers } from "@/lib/auth/userStore";
import { changePassword } from "@/services/authApi";
import { updateUser } from "@/services/userService";

const card = "flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6";
const submitClass =
  "self-start rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const Problem = ({ text }: { text: string }) =>
  text ? (
    <p role="alert" className="text-xs text-red-600 dark:text-red-300">
      {text}
    </p>
  ) : null;

/** The signed-in user's own settings: their name and their password. */
export default function SettingsPage() {
  const { user, isSuperAdmin } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  // The Super Admin's email is fixed; everyone else can change their own name and email.
  const cleanName = name.replace(/\s+/g, " ").trim();
  const checkedEmail = validateEmail(email);
  const nameChanged = !!cleanName && cleanName !== user.name;
  const emailChanged = !isSuperAdmin && checkedEmail.ok && checkedEmail.email !== user.email;
  const emailInvalid = !isSuperAdmin && email.trim() !== user.email && !checkedEmail.ok;
  const canSaveProfile = (nameChanged || emailChanged) && !emailInvalid;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!user || savingName) return;
    if (!cleanName) return setNameError("Enter your name.");
    if (emailInvalid) return setNameError(checkedEmail.ok ? "" : checkedEmail.message.replace("can sign in", "can be used"));
    if (!nameChanged && !emailChanged) return;
    setSavingName(true);
    setNameError("");
    try {
      const patch = { ...(nameChanged ? { name: cleanName } : {}), ...(emailChanged && checkedEmail.ok ? { email: checkedEmail.email } : {}) };
      await updateUser(user.id, patch);
      const session = sessionStore.read();
      if (session) sessionStore.write({ token: session.token, user: { ...session.user, ...patch } });
      void refreshUsers(true);
      setName(cleanName);
      if (patch.email) setEmail(patch.email);
      toast.show(patch.email && patch.name ? "Name and email updated" : patch.email ? "Email updated" : "Name updated");
    } catch (err) {
      setNameError(getErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (savingPassword) return;
    if (!current) return setPasswordError("Enter your current password.");
    const problem = checkNewPassword(next);
    if (problem) return setPasswordError(problem);
    if (next === current) return setPasswordError("The new password must be different from the current one.");
    if (next !== confirm) return setPasswordError("The new passwords don't match.");
    setSavingPassword(true);
    setPasswordError("");
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.show("Password changed");
    } catch (err) {
      setPasswordError(getErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Your name and password." />

      <form onSubmit={saveName} noValidate className={card} aria-label="Profile">
        <h2 className="text-base font-semibold">Profile</h2>
        <TextField label="Name" required value={name} onChange={(v) => (setName(v), setNameError(""))} />
        {isSuperAdmin ? (
          <Field label="Email">
            <input value={user.email} readOnly disabled className={`${controlClass} h-10 disabled:opacity-60`} />
          </Field>
        ) : (
          <EmailField label="Email" required value={email} onChange={(v) => (setEmail(v), setNameError(""))} />
        )}
        <Problem text={nameError || (emailInvalid && email.trim() && !checkedEmail.ok ? checkedEmail.message.replace("can sign in", "can be used") : "")} />
        <button type="submit" disabled={savingName || !canSaveProfile} className={submitClass}>
          {savingName ? "Saving…" : "Save changes"}
        </button>
      </form>

      <form onSubmit={savePassword} noValidate className={card} aria-label="Change password">
        <h2 className="text-base font-semibold">Change password</h2>
        <PasswordField label="Current password" required autoComplete="current-password" value={current} onChange={(v) => (setCurrent(v), setPasswordError(""))} />
        <PasswordField label="New password" required value={next} onChange={(v) => (setNext(v), setPasswordError(""))} placeholder="At least 8 characters" />
        <PasswordField label="Confirm new password" required value={confirm} onChange={(v) => (setConfirm(v), setPasswordError(""))} />
        <Problem text={passwordError} />
        <button type="submit" disabled={savingPassword} className={submitClass}>
          {savingPassword ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
