"use client";

import { DisabledTip } from "@/components/ui/DisabledTip";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { Field, TextField, controlClass } from "@/components/ui/FormControls";
import { PasswordField } from "@/components/ui/PasswordField";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { DEFAULT_INITIAL_PASSWORD, LOGIN_PATH } from "@/constants/auth";
import { getErrorMessage } from "@/lib/apiClient";
import { signOutAfterPasswordChange } from "@/lib/auth/authService";
import { MIN_PASSWORD_LENGTH, TOO_SHORT, checkNewPassword } from "@/lib/auth/passwordRules";
import { sessionStore } from "@/lib/auth/sessionStore";
import { refreshUsers } from "@/lib/auth/userStore";
import { changePassword } from "@/services/authApi";
import { updateUser } from "@/services/userService";
import { FieldError } from "@/components/ui/FieldError";
import PasswordChangeNotice from "./PasswordChangeNotice";

const NEEDS_NEW = `Enter your new password (at least ${MIN_PASSWORD_LENGTH} characters) first.`;
const NEEDS_CURRENT = `Enter your current password (at least ${MIN_PASSWORD_LENGTH} characters) first.`;
const SAME_AS_CURRENT = "New password must be different from the current password.";
const INITIAL_REUSED = "Choose a password different from the initial password.";
const MISMATCH = "New password and confirm password do not match.";
const card = "flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6";
const cancelClass =
  "rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const submitClass =
  "btn-brand rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const Problem = ({ text }: { text: string }) =>
  text ? (
    <FieldError>
      {text}
    </FieldError>
  ) : null;

/** The signed-in user's own settings: their name and their password. */
export default function SettingsPage() {
  const { user, mustChangePassword: forced } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = useState(user?.name ?? "");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Signed in with the shared initial password: it is known to be the current one, so the field starts with it (kept in this form only, never stored).
  const [current, setCurrent] = useState(() => (user?.usesInitialPassword ? DEFAULT_INITIAL_PASSWORD : ""));
  const [noticeDone, setNoticeDone] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // After the popup: the Current password field takes focus.
  useEffect(() => {
    if (noticeDone) document.querySelector<HTMLInputElement>('form[aria-label="Change password"] input[name="current-password"]')?.focus();
  }, [noticeDone]);

  if (!user) return null;

  // The email is fixed for every role: only the name can be changed here.
  const cleanName = name.replace(/\s+/g, " ").trim();
  const nameChanged = !!cleanName && cleanName !== user.name;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!user || savingName) return;
    if (!cleanName) return setNameError("Enter your name.");
    if (!nameChanged) return;
    setSavingName(true);
    setNameError("");
    try {
      const patch = { name: cleanName };
      await updateUser(user.id, patch);
      const session = sessionStore.read();
      if (session) sessionStore.write({ token: session.token, user: { ...session.user, ...patch } });
      void refreshUsers(true);
      setName(cleanName);
      toast.show("Name updated");
    } catch (err) {
      setNameError(getErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  }

  // Shown as soon as a confirmation is typed that differs; gone when both match.
  // The new passwords unlock once the current password has the minimum length.
  // Each field unlocks the next one once it has the minimum length. Only real characters count: spaces before or after do not.
  const enough = (v: string) => v.trim().length >= MIN_PASSWORD_LENGTH;
  const currentOk = enough(current);
  const unlocked = currentOk; // New password
  const newOk = unlocked && enough(next); // Confirm new password
  const mismatch = newOk && !!confirm && next !== confirm;
  // Too short: shown while a typed new or confirm password has fewer characters than the minimum; gone at once when it has enough.
  const tooShort = (!!next && !enough(next)) || (!!confirm && !enough(confirm));
  // The new password can't be the one already in use: shown while they are identical, gone as soon as they differ.
  const sameAsCurrent = currentOk && !!next && next === current;
  // The initial password can never be chosen again.
  const isInitial = !!next && next === DEFAULT_INITIAL_PASSWORD;
  const passwordReady = currentOk && newOk && !!confirm && !mismatch && !tooShort && !sameAsCurrent && !isInitial;

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (savingPassword) return;
    if (!currentOk) return setPasswordError(current ? NEEDS_CURRENT : "Enter your current password.");
    const problem = enough(next) ? checkNewPassword(next) : TOO_SHORT;
    if (problem) return setPasswordError(problem);
    if (next === current) return setPasswordError("The new password must be different from the current one.");
    if (isInitial) return setPasswordError(INITIAL_REUSED);
    if (next !== confirm) return setPasswordError(MISMATCH);
    setSavingPassword(true);
    setPasswordError("");
    try {
      await changePassword(current, next);
      // The backend accepted it: the session ends and the person signs in again with the new password.
      signOutAfterPasswordChange();
      router.replace(LOGIN_PATH);
      return;
    } catch (err) {
      setPasswordError(getErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  const initialsOf = user.name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader title="Settings" description="Manage your profile and keep your account secure." />

      {forced && !noticeDone && <PasswordChangeNotice onContinue={() => setNoticeDone(true)} />}

      {/* Who is signed in: a summary strip across the whole width. */}
      <section aria-label="Account" className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent" aria-hidden="true">
          {initialsOf || "?"}
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="truncate text-lg font-semibold">{user.name}</p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
        <ul className="flex flex-wrap gap-2 text-xs">
          <li className="rounded-full border border-border px-3 py-1 text-muted">{user.role}</li>
          {user.team && <li className="rounded-full border border-border px-3 py-1 text-muted">{user.team}</li>}
          <li className={`rounded-full px-3 py-1 font-medium ${user.status === "Enabled" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300"}`}>
            {user.status}
          </li>
        </ul>
      </section>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <form onSubmit={saveName} noValidate className={card} aria-label="Profile">
          <header>
            <h2 className="text-base font-semibold">Profile</h2>
            <p className="mt-0.5 text-sm text-muted">Your name, and the email you sign in with (read-only).</p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <TextField label="Name" required value={name} onChange={(v) => (setName(v), setNameError(""))} />
            <Field label="Email">
              <input value={user.email} readOnly disabled aria-readonly="true" className={`${controlClass} h-10 disabled:opacity-60`} />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-muted">Your email can&apos;t be changed.</p>
          <Problem text={nameError} />
          <footer className="mt-auto flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <DisabledTip reason={!savingName && !nameChanged && "No changes to make."} className="inline-block">
            <button
              type="button"
              onClick={() => (setName(user.name), setNameError(""))}
              disabled={savingName || !nameChanged}
              className={cancelClass}
            >
              Cancel
            </button>
            </DisabledTip>
            <DisabledTip reason={!savingName && !nameChanged && "No changes to save."} className="inline-block">
            <button type="submit" disabled={savingName || !nameChanged} className={submitClass}>
              {savingName ? "Saving…" : "Save changes"}
            </button>
            </DisabledTip>
          </footer>
        </form>

        <form onSubmit={savePassword} noValidate className={card} aria-label="Change password">
          <header>
            <h2 className="text-base font-semibold">Change password</h2>
            <p className="mt-0.5 text-sm text-muted">Use at least 8 characters. You&apos;ll need your current password.</p>
          </header>
          <PasswordField
            label="Current password"
            required
            name="current-password"
            autoComplete="current-password"
            value={current}
            onChange={(v) => {
              setCurrent(v);
              setPasswordError("");
              // Without the current password the new ones can't be used: they are cleared at once.
              if (!enough(v)) {
                setNext("");
                setConfirm("");
              }
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <PasswordField label="New password" required invalid={sameAsCurrent || isInitial || (!!next && !enough(next))} aria-describedby={sameAsCurrent ? "password-same" : isInitial ? "password-initial" : undefined} disabled={!unlocked} disabledReason={NEEDS_CURRENT} value={next} onChange={(v) => {
              setNext(v);
              setPasswordError("");
              // Below the minimum, the next field locks again and its entry is cleared.
              if (!enough(v)) setConfirm("");
            }} placeholder="At least 8 characters" />
            <PasswordField label="Confirm new password" required disabled={!newOk} disabledReason={unlocked ? NEEDS_NEW : NEEDS_CURRENT} invalid={mismatch || (!!confirm && !enough(confirm))} aria-describedby={[tooShort && "password-short", mismatch && "password-mismatch"].filter(Boolean).join(" ") || undefined} value={confirm} onChange={(v) => (setConfirm(v), setPasswordError(""))} />
          </div>
          {sameAsCurrent && (
            <FieldError id="password-same">
              {SAME_AS_CURRENT}
            </FieldError>
          )}
          {isInitial && !sameAsCurrent && (
            <FieldError id="password-initial">
              {INITIAL_REUSED}
            </FieldError>
          )}
          {tooShort && (
            <FieldError id="password-short">
              {TOO_SHORT}
            </FieldError>
          )}
          {mismatch && (
            <FieldError id="password-mismatch">
              {MISMATCH}
            </FieldError>
          )}
          <Problem text={passwordError} />
          <footer className="mt-auto flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <DisabledTip reason={!savingPassword && !(current || next || confirm) && "Nothing to clear."} className="inline-block">
            <button
              type="button"
              onClick={() => (setCurrent(""), setNext(""), setConfirm(""), setPasswordError(""))}
              disabled={savingPassword || !(current || next || confirm)}
              className={cancelClass}
            >
              Clear
            </button>
            </DisabledTip>
            <DisabledTip reason={!savingPassword && !passwordReady && (sameAsCurrent ? SAME_AS_CURRENT : isInitial ? INITIAL_REUSED : tooShort ? TOO_SHORT : mismatch ? MISMATCH : "Fill in the current, new and confirm password fields to continue.")} className="inline-block">
            <button type="submit" disabled={savingPassword || !passwordReady} className={submitClass}>
              {savingPassword ? "Saving…" : "Change password"}
            </button>
            </DisabledTip>
          </footer>
        </form>
      </div>
    </div>
  );
}
