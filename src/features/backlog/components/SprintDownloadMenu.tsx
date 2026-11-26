"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useMenuPresence } from "@/hooks/usePresence";
import { getErrorMessage } from "@/lib/apiClient";
import { useBacklog } from "../context/BacklogContext";
import { downloadSprintExcel, exportableSprints } from "../exportSprintExcel";

/**
 * The Download button at the top of Sprint plan: the running sprint, the Backlog, or every sprint with the Backlog, as one Excel file from the data already on the page.
 * Choices that have nothing to download are off and say why.
 */
export default function SprintDownloadMenu() {
  const { status, items, sprints, activeSprint, itemsPaging } = useBacklog();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const menu = useMenuPresence(open);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const loading = status !== "ready" || !itemsPaging.complete;
  const inSprint = (name: string) => items.filter((i) => i.sprint === name).length;
  const backlog = items.filter((i) => i.sprint === "Unplanned").length;
  const choices: { scope: "active" | "backlog" | "all"; label: string; hint: string; off: string }[] = [
    { scope: "active", label: "Active sprint", hint: activeSprint ? `${activeSprint.name} · ${inSprint(activeSprint.name)} tasks` : "", off: activeSprint ? "" : "No sprint is running." },
    { scope: "backlog", label: "Backlog", hint: `${backlog} ${backlog === 1 ? "task" : "tasks"} in no sprint`, off: backlog === 0 ? "The Backlog has no tasks." : "" },
    { scope: "all", label: "All sprints and Backlog", hint: `${exportableSprints(sprints).length} sprints then the Backlog, in one table`, off: "" },
  ];

  async function download(scope: "active" | "backlog" | "all") {
    if (busy) return;
    setBusy(scope);
    try {
      await downloadSprintExcel({ scope, items, sprints });
      toast.show("Excel file downloaded");
      setOpen(false);
    } catch (err) {
      toast.show(getErrorMessage(err), "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        aria-haspopup="menu"
        aria-expanded={open}
        title={loading ? "Still loading all tasks…" : "Download tasks as Excel"}
        className="btn btn-secondary"
      >
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
        </svg>
        <span className="max-sm:sr-only">Download</span>
      </button>
      {menu.mounted && (
        <div role="menu" aria-label="Download as Excel" className={`${menu.motion} absolute right-0 top-full z-30 mt-1.5 flex w-72 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-border bg-surface p-1 shadow-menu`}>
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Download as Excel</p>
          {choices.map((c) => (
            <button
              key={c.scope}
              type="button"
              role="menuitem"
              onClick={() => void download(c.scope)}
              disabled={!!c.off || !!busy}
              title={c.off || undefined}
              className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="font-medium">{busy === c.scope ? "Preparing…" : c.label}</span>
              <span className="text-xs text-muted">{c.off || c.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
