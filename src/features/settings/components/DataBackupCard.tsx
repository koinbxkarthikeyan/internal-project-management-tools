"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/apiClient";
import { exportDatabase, readBackup, restoreDatabase, type BackupSummary } from "@/lib/localApi";

const card = "flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6";
const quiet = "h-10 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "unknown time" : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};

/** For the Super Admin: the data lives on the shared server, so it can be saved to a file and put back. */
export default function DataBackupCard() {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ text: string; name: string; summary: BackupSummary } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function download() {
    try {
      const { text, summary } = await exportDatabase();
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `koinbx-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.show(`Backup saved: ${summary.tasks} tasks, ${summary.users} users, ${summary.sprints} sprints`);
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
    }
  }

  async function choose(file: File | undefined) {
    setError("");
    setPending(null);
    if (!file) return;
    try {
      const text = await file.text();
      setPending({ text, name: file.name, summary: (await readBackup(text)).summary });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function restore() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await restoreDatabase(pending.text);
      toast.show("Data restored. Reloading…");
      // Everything on screen came from the old data: start again from the restored one.
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <section aria-label="Backup and restore" className={card}>
      <header>
        <h2 className="text-base font-semibold">Backup &amp; restore</h2>
        <p className="mt-0.5 text-sm text-muted">
          Everything is kept on the shared server, so every computer sees it. Save a copy to a file now and then. The file holds your data and everyone&apos;s sign-in hashes, so keep it private. Images attached to Tickets are stored separately on the server and are not in the file.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} className="btn-brand h-10 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Export backup
        </button>
        <button type="button" onClick={() => input.current?.click()} className={quiet}>
          Restore from file…
        </button>
        <input ref={input} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Backup file" onChange={(e) => void choose(e.target.files?.[0])} />
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {pending && (
        <div role="alertdialog" aria-label="Confirm restore" className="flex flex-col gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm">
            <strong className="font-semibold">{pending.name}</strong>, saved {when(pending.summary.exportedAt)}: {pending.summary.tasks} tasks, {pending.summary.users} users, {pending.summary.sprints} sprints, {pending.summary.owners} owners, {pending.summary.entries} hour entries and {pending.summary.comments} comments.
          </p>
          <p className="text-sm font-medium text-red-700 dark:text-red-300">Restoring replaces everything now on the shared server, for everyone. This can&apos;t be undone, so export a backup first if you might need today&apos;s data.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void restore()} disabled={busy} className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">
              {busy ? "Restoring…" : "Replace everything with this backup"}
            </button>
            <button type="button" onClick={() => setPending(null)} disabled={busy} className={quiet}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
