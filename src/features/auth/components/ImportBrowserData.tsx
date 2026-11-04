"use client";

import { useEffect, useState } from "react";
import { importLegacyData, readLegacyData, type LegacyData } from "@/lib/legacyBrowserData";

/**
 * Shown on the first-run screen when this browser holds data from before the app had shared storage: it offers to move that data to the shared server once, so every
 * computer sees the same accounts and work. The data in this browser is kept as it is.
 */
export default function ImportBrowserData() {
  const [found, setFound] = useState<LegacyData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void readLegacyData().then((d) => !cancelled && setFound(d)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!found) return null;
  const { users, tasks, images } = found.summary;

  async function run() {
    if (!found || busy) return;
    setBusy(true);
    setError("");
    try {
      await importLegacyData(found);
      window.location.reload(); // the server has accounts now: the normal sign-in is shown
    } catch (err) {
      setError(err instanceof Error ? err.message : "The data could not be imported.");
      setBusy(false);
    }
  }

  return (
    <div role="region" aria-label="Existing data in this browser" className="mb-5 flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent-soft/40 p-4 text-sm">
      <p className="font-semibold">This browser has existing data</p>
      <p className="text-muted">
        {users} {users === 1 ? "user" : "users"}, {tasks} {tasks === 1 ? "task" : "tasks"} and {images} {images === 1 ? "image" : "images"} were kept here before the app had shared storage. Import them to the shared server so everyone sees the same data from any computer. Nothing is deleted from this browser.
      </p>
      {error && <p role="alert" className="text-red-700 dark:text-red-300">{error}</p>}
      <button type="button" onClick={() => void run()} disabled={busy} className="btn-brand h-10 w-fit rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {busy ? "Importing…" : "Import existing data"}
      </button>
    </div>
  );
}
