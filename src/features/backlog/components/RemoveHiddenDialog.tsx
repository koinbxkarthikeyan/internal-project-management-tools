"use client";

import { useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/apiClient";

/** Asks before permanently removing every hidden task with its child Tickets, comments and images. Nothing is removed until "Remove all hidden" is pressed. */
export default function RemoveHiddenDialog({ count, onConfirm, onClose }: { count: number; onConfirm: () => Promise<void>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  async function go() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      ref.current?.close();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === ref.current && !busy && ref.current?.close()}
      aria-label="Remove all hidden tasks"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-5 text-foreground shadow-modal backdrop:bg-black/60"
    >
      <h2 className="text-base font-semibold">Remove all hidden tasks?</h2>
      <p className="mt-2 text-sm text-muted">
        This permanently deletes {count === 1 ? "the hidden task" : `all ${count} hidden tasks`} together with their child Tickets, comments and images. It can&apos;t be undone. Hidden tasks in a closed sprint stay, as they can&apos;t be changed.
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => ref.current?.close()} disabled={busy} className="h-9 rounded-lg border border-border px-4 text-sm hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">Cancel</button>
        <button type="button" onClick={() => void go()} disabled={busy} className="h-9 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60">
          {busy ? "Removing…" : "Remove all hidden"}
        </button>
      </div>
    </dialog>
  );
}
