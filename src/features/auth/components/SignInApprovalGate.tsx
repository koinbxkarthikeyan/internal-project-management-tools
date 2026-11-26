"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage, getErrorStatus } from "@/lib/apiClient";
import { answerSignInRequest, listSignInRequests, type SignInRequest } from "@/services/authApi";

const POLL_MS = 3000;

/** "Chrome on Windows" from a browser's user-agent text; the raw text when it is not one we know. */
function deviceName(agent: string): string {
  const browser = /Edg\//.test(agent) ? "Edge" : /OPR\/|Opera/.test(agent) ? "Opera" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "";
  const os = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad|iOS/.test(agent) ? "iOS" : /Mac OS X|Macintosh/.test(agent) ? "macOS" : /Linux|X11/.test(agent) ? "Linux" : "";
  return browser && os ? `${browser} on ${os}` : browser || os || "an unknown browser";
}

/**
 * Mounted once in the signed-in layout, so it works on every page. It asks the server every few seconds for sign-ins waiting on other computers for this account and, while there is
 * one, covers the app with a pop-up that can only be answered: **Allow** lets that computer in, **Deny** turns it away. Esc and a click outside do nothing. With several waiting,
 * the oldest comes first.
 */
export default function SignInApprovalGate() {
  const [requests, setRequests] = useState<SignInRequest[]>([]);
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const current = requests[0];

  const refresh = useCallback(async () => {
    try {
      setRequests(await listSignInRequests());
    } catch {
      /* a failed check is tried again at the next turn (a 401 already signed the person out) */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && void refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // The pop-up is open while something waits; the same one keeps its place (and any error) until that request is answered or gone.
  const id = current?.id;
  useEffect(() => {
    setError("");
    const d = ref.current;
    if (id && d && !d.open) d.showModal();
  }, [id]);

  async function answer(allow: boolean) {
    if (!current || busy) return;
    setBusy(allow ? "allow" : "deny");
    setError("");
    try {
      await answerSignInRequest(current.id, allow);
      setRequests((r) => r.filter((x) => x.id !== current.id));
    } catch (err) {
      // Already answered or run out: it is gone, so move on; any other problem can be tried again.
      if (getErrorStatus(err) === 410) await refresh();
      else setError(getErrorMessage(err));
    }
    setBusy(null);
  }

  if (!current) return null;
  const when = new Date(current.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <dialog
      ref={ref}
      // It can only be answered: Esc is ignored (and a click outside does nothing, as the backdrop is not a close target).
      onCancel={(e) => e.preventDefault()}
      aria-labelledby="signin-approval-title"
      className="modal-confirm p-5"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/15 font-semibold text-amber-600 dark:text-amber-400">!</span>
        <div className="min-w-0">
          <h2 id="signin-approval-title" className="text-base font-semibold">Someone is signing in to your account</h2>
          <p className="mt-2 text-sm text-muted">A computer entered your password and is waiting for you to approve it.</p>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 card-inset px-3 py-2 text-sm">
            <dt className="text-muted">Device</dt>
            <dd className="break-words font-medium">{deviceName(current.agent)}</dd>
            <dt className="text-muted">Address</dt>
            <dd className="break-all font-medium">{current.ip}</dd>
            <dt className="text-muted">Time</dt>
            <dd className="font-medium">{when}</dd>
          </dl>
          <p className="mt-3 text-sm text-muted">Was this you? <strong className="text-foreground">Allow</strong> lets that computer in. <strong className="text-foreground">Deny</strong> turns it away. If it was not you, choose Deny and change your password.</p>
          {requests.length > 1 && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">{requests.length - 1} more waiting after this one.</p>}
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => void answer(false)} disabled={!!busy} aria-busy={busy === "deny"} className="btn btn-secondary">{busy === "deny" ? "Denying…" : "Deny"}</button>
        <button type="button" onClick={() => void answer(true)} disabled={!!busy} aria-busy={busy === "allow"} className="btn btn-brand">{busy === "allow" ? "Allowing…" : "Allow"}</button>
      </div>
    </dialog>
  );
}
