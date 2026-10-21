"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { FieldError } from "@/components/ui/FieldError";
import EmptyState from "@/components/ui/EmptyState";
import { CloseIcon, PlusIcon, UploadIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { useQueryState } from "@/hooks/useQueryState";
import { useAuth } from "@/features/auth/hooks/useAuth";
import BacklogDrawer from "@/features/backlog/components/BacklogDrawer";
import { useBacklog } from "@/features/backlog/context/BacklogContext";
import { teamSuggestions } from "@/features/backlog/ownerGroups";
import CreateOwnerDrawer from "@/features/backlog/components/CreateOwnerDrawer";
import UserFormDrawer from "@/features/users/components/UserFormDrawer";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useBacklogStore } from "@/stores/backlogStore";
import { getErrorMessage } from "@/lib/apiClient";
import { submitBulk } from "@/services/bulkService";
import { teamOptions } from "@/lib/auth/teams";
import { refreshUsers } from "@/lib/auth/userStore";
import { resolveTeam, useTeamStore } from "@/stores/teamStore";
import { useUsersStore } from "@/stores/usersStore";
import { isBlankValues } from "../bulkDraft";
import { downloadTemplate, ExcelImportError, readRows } from "../bulkExcel";
import { loadAutoSavePref, loadDraft, saveAutoSavePref, saveDraft, snapshotKey, type DraftSnapshot } from "../bulkDraft";
import { BULK_SPECS, BULK_TYPES, resolveOne, tokens, type BulkType, type Column, type Ctx, type Problems, type Row, type Values } from "../bulkSpecs";
import CellPicker from "./CellPicker";

let sequence = 0;
const newRow = (values: Values): Row => ({ id: `row-${++sequence}`, values });
const NOUN: Record<BulkType, [string, string]> = { backlog: ["backlog item", "backlog items"], owner: ["owner", "owners"], users: ["team member", "team members"] };

/**
 * Keeps the table ending in exactly one empty row to type the next record in: extra empty rows at the end are dropped, and when the last row has all
 * its required fields filled in, one empty row is added. A row still being filled in is itself the working row, so nothing is added under it.
 */
function withSpareRow(rows: Row[], spec: (typeof BULK_SPECS)[BulkType]): Row[] {
  const blank = spec.blank();
  const isBlank = (r: Row) => spec.columns.every((c) => (r.values[c.key] ?? "") === (blank[c.key] ?? ""));
  const complete = (r: Row) => spec.columns.filter((c) => c.required).every((c) => (r.values[c.key] ?? "").trim() !== "");
  const out = [...rows];
  while (out.length > 1 && isBlank(out[out.length - 1]) && isBlank(out[out.length - 2])) out.pop();
  if (out.length === 0) return [newRow({ ...blank })];
  const last = out[out.length - 1];
  if (!isBlank(last) && complete(last)) out.push(newRow({ ...blank }));
  return out;
}

const inputClass = "field h-10 w-full px-3 text-sm placeholder:text-muted";
const secondaryButton = "inline-flex h-10 items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-accent";
const th = "px-2 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted whitespace-nowrap";

type Failure = { row: string; message: string };

/**
 * Bulk Upload (Admins): pick Backlog, Owner or Users, fill a table with one record per row, check it, confirm, and upload. Rows are saved through the
 * same create calls as the single forms, one at a time, and every row's outcome is shown: saved rows leave the table, failed ones stay with the reason.
 */
export default function BulkUploadPage() {
  const { isAdmin, isSuperAdmin, user } = useAuth();
  const userId = user?.id ?? "";
  const searchParams = useSearchParams();
  const { owners, ownerRecords, activeSprint, reload } = useBacklog();
  const users = useUsers();
  const toast = useToast();
  const renames = useTeamStore((s) => s.renames);
  const deleted = useTeamStore((s) => s.deleted);
  const custom = useTeamStore((s) => s.custom);

  // The open tab is kept in the URL (?type=owner). Each tab keeps its own rows, problems and results, so switching tabs and back loses nothing.
  const [type, setType] = useQueryState<BulkType>("type", BULK_TYPES.map((t) => t.value), "backlog");
  // What was left in this browser last time (checked when read). The page only mounts after sign-in is known, so reading it here is safe.
  const [restored] = useState(() => loadDraft(userId));
  const [drafts, setDrafts] = useState<Record<BulkType, Row[]>>(() => ({
    backlog: withSpareRow((restored?.rows.backlog ?? []).map((v) => newRow(v)), BULK_SPECS.backlog),
    owner: withSpareRow((restored?.rows.owner ?? []).map((v) => newRow(v)), BULK_SPECS.owner),
    users: withSpareRow((restored?.rows.users ?? []).map((v) => newRow(v)), BULK_SPECS.users),
  }));
  const [attemptedBy, setAttemptedBy] = useState<Partial<Record<BulkType, boolean>>>({});
  const attempted = !!attemptedBy[type];
  const setAttempted = (value: boolean) => setAttemptedBy((a) => ({ ...a, [type]: value }));
  // "+ Create New Owner / Team Member" from a cell opens the same form as in Create backlog; the new record is then chosen in that cell.
  const [creating, setCreating] = useState<{ kind: "owner" | "member"; rowId: string; key: string; multi: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [uploading, setUploading] = useState(false);
    const [failed, setFailed] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<{ saved: number; failures: Failure[]; type: BulkType; error?: string } | null>(null);
  // Excel: rows read from a file wait here (with the tab they are for) when the table already has entries, until the person picks replace or add.
  const [importing, setImporting] = useState<{ tab: BulkType; rows: Values[] } | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelError, setExcelError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false); // a double click on Upload must not send everything twice
  // ----- Auto-Save: a local draft only. Nothing here talks to the server; records are created only by Submit. -----
  const [autoSave, setAutoSave] = useState(loadAutoSavePref);
  const toSnapshot = (tab: BulkType, all: Record<BulkType, Row[]>): DraftSnapshot => ({ tab, rows: { backlog: all.backlog.map((r) => r.values), owner: all.owner.map((r) => r.values), users: all.users.map((r) => r.values) } });
  const snapshot = useMemo(() => snapshotKey(toSnapshot(type, drafts)), [type, drafts]);
  const [savedKey, setSavedKey] = useState(snapshot); // the draft as it is stored right now
  const [wrote, setWrote] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const pending = useRef<string | null>(null); // the newest text waiting for its turn to be stored
  const warned = useRef(false);
  const dirty = autoSave && snapshot !== savedKey;

  useEffect(() => {
    if (!dirty || !userId) return;
    pending.current = snapshot;
    // A short pause after the last change; a newer change cancels this timer, so an older copy can never be stored after a newer one.
    const timer = setTimeout(() => {
      const ok = saveDraft(userId, snapshot);
      pending.current = null;
      setSaveFailed(!ok);
      if (ok) {
        setSavedKey(snapshot);
        setWrote(true);
        warned.current = false;
      } else if (!warned.current) {
        warned.current = true;
        toast.show("This draft couldn't be saved in your browser (storage may be full or blocked). Your entries are still on screen.", "danger");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [dirty, snapshot, userId, toast]);

  // Leaving the page (another page, a refresh, closing the tab) stores whatever was still waiting for the pause to end.
  useEffect(() => {
    const flush = () => {
      if (pending.current && userId) saveDraft(userId, pending.current);
      pending.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [userId]);

  // Opening the page without a tab in the address brings back the tab that was open last time.
  const tabRestored = useRef(false);
  useEffect(() => {
    if (tabRestored.current) return;
    tabRestored.current = true;
    if (restored && !searchParams.has("type") && restored.tab !== type) setType(restored.tab);
  }, [restored, searchParams, type, setType]);

  function toggleAutoSave() {
    const next = !autoSave;
    setAutoSave(next);
    saveAutoSavePref(next);
    setSaveFailed(false);
  }
  const saveStatus = !autoSave ? "Auto-Save Off" : saveFailed ? "Save failed" : dirty ? "Saving…" : wrote ? "Draft saved" : "Auto-Save On";


  const ctx: Ctx = useMemo(
    () => ({
      owners,
      ownerRecords,
      users,
      sprintOptions: [...(activeSprint ? [{ value: activeSprint.name, label: activeSprint.name }] : []), { value: "Unplanned", label: "Unplanned Task" }],
      teams: teamOptions(users, [], { renames, deleted, custom }),
      ownerTeams: teamSuggestions(ownerRecords).map((t) => resolveTeam(t, renames)),
      isSuperAdmin,
    }),
    [owners, ownerRecords, users, activeSprint, renames, deleted, custom, isSuperAdmin],
  );

  const spec = BULK_SPECS[type];
  const rows = drafts[type];
  const setRows = (next: (rows: Row[]) => Row[]) => setDrafts((d) => ({ ...d, [type]: withSpareRow(next(d[type]), BULK_SPECS[type]) }));
  const isBlank = (r: Row) => spec.columns.every((c) => (r.values[c.key] ?? "") === (spec.blank()[c.key] ?? ""));
  const filled = rows.filter((r) => !isBlank(r));

  // Problems are shown once Submit has been tried, and then follow every edit, so a fixed cell clears at once.
  const problems = useMemo<Record<string, Problems>>(() => {
    if (!attempted) return {};
    const out: Record<string, Problems> = {};
    for (const r of rows) {
      if (isBlank(r)) continue;
      const p = spec.check(r, rows.filter((x) => !isBlank(x)), ctx);
      if (Object.keys(p).length) out[r.id] = p;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempted, spec, rows, ctx]);
  const problemCount = Object.values(problems).reduce((n, p) => n + Object.keys(p).length, 0);

  function edit(row: Row, col: Column, raw: string) {
    const formatted = col.format ? col.format(raw) : raw;
    const value = col.typing ? col.typing(row.values[col.key] ?? "", formatted) : formatted;
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== row.id) return r;
        const values = { ...r.values, [col.key]: value };
        if (type === "users" && col.key === "role" && value !== "Admin") values.status = "Enabled"; // only an Admin account can be set Disabled
        return { ...r, values };
      }),
    );
    if (failed[row.id])
      setFailed((f) => {
        const next = { ...f };
        delete next[row.id];
        return next;
      });
  }

  function assign(rowId: string, key: string, multi: boolean, id: string) {
    setRows((rs) =>
      rs.map((r) => (r.id !== rowId ? r : { ...r, values: { ...r.values, [key]: multi ? [...new Set([...tokens(r.values[key] ?? ""), id])].join(",") : id } })),
    );
  }

  const addRow = () => setRows((rs) => [...rs, newRow({ ...spec.blank() })]);
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  // Clear empties only the open tab (after the person confirms); the other tabs keep what was entered.
  function clearAll() {
    const ids = new Set(rows.map((r) => r.id));
    setRows(() => []);
    setAttempted(false);
    setFailed((f) => Object.fromEntries(Object.entries(f).filter(([id]) => !ids.has(id))));
    setSummary((x) => (x?.type === type ? null : x));
  }

  /** Puts rows read from Excel into a tab's table, replacing what is there or after it. Only fills the table: nothing is sent to the server. */
  function applyImport(tab: BulkType, imported: Values[], mode: "replace" | "append") {
    setDrafts((d) => {
      const keep = mode === "append" ? d[tab].filter((r) => !BULK_SPECS[tab].columns.every((c) => (r.values[c.key] ?? "") === (BULK_SPECS[tab].blank()[c.key] ?? ""))) : [];
      return { ...d, [tab]: withSpareRow([...keep, ...imported.map((v) => newRow(v))], BULK_SPECS[tab]) };
    });
    if (mode === "replace") setFailed({});
    setSummary(null);
    setAttemptedBy((a) => ({ ...a, [tab]: true })); // show what is wrong with the imported cells straight away
    toast.show(`${imported.length} ${imported.length === 1 ? NOUN[tab][0] : NOUN[tab][1]} imported into the table. Check them, then Submit.`);
  }

  async function runExcel(job: () => Promise<void>) {
    if (excelBusy) return;
    setExcelBusy(true);
    try {
      await job();
    } catch (err) {
      const message = err instanceof ExcelImportError ? err.message : "The Excel file could not be processed.";
      setExcelError(message);
      toast.show(message, "danger");
    } finally {
      setExcelBusy(false);
    }
  }

  function pickFile() {
    fileInput.current?.click();
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const tab = type;
    setExcelError("");
    void runExcel(async () => {
      const imported = await readRows(file, tab, ctx);
      if (filled.length === 0) applyImport(tab, imported, "replace");
      else setImporting({ tab, rows: imported });
    });
  }

  function submit() {
    if (uploading) return;
    setAttempted(true);
    setSummary(null);
    if (filled.length === 0) return void toast.show("Add at least one record before uploading.", "warning");
    const any = filled.some((r) => Object.keys(spec.check(r, filled, ctx)).length > 0);
    if (any) {
      toast.show("Some cells need fixing. They are marked in red.", "warning");
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-bulk-table] [aria-invalid="true"]')?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }));
      return;
    }
    setConfirming(true);
  }

  async function upload() {
    if (busy.current) return;
    busy.current = true;
    const target = type;
    const batch = filled;
    setUploading(true);
    // One request per tab. First each valid row becomes its record; a row whose record cannot be built is reported on its own and left out.
    const records: { row: Row; body: unknown }[] = [];
    const failures: Record<string, string> = {};
    for (const row of batch) {
      try {
        records.push({ row, body: BULK_SPECS[target].toBody(row.values, ctx) });
      } catch (err) {
        failures[row.id] = getErrorMessage(err);
      }
    }
    const saved: string[] = [];
    let wholeFailure = "";
    if (records.length > 0) {
      try {
        const outcome = await submitBulk(target, records.map((r) => r.body));
        const refused = new Map(outcome.failed.map((f) => [f.index, f.message]));
        records.forEach((r, i) => {
          const why = refused.get(i);
          if (why) failures[r.row.id] = why;
          else saved.push(r.row.id);
        });
      } catch (err) {
        wholeFailure = getErrorMessage(err);
      }
    }
    const [one, many] = NOUN[target];
    if (wholeFailure) {
      // The request failed: nothing is treated as saved, every row stays, and the draft is untouched.
      setSummary({ saved: 0, failures: [], type: target, error: wholeFailure });
      toast.show(`The upload failed: ${wholeFailure} Your entries are kept.`, "danger");
    } else {
      if (saved.length > 0) {
        if (target === "users") {
          for (const r of batch) if (saved.includes(r.id) && r.values.team?.trim()) useTeamStore.getState().addCustom(r.values.team.trim());
          await refreshUsers(true);
          useUsersStore.getState().invalidateManaged();
        } else {
          reload(); // read the new items / owners back from the server
        }
      }
      const label = (r: Row) => r.values.title || r.values.name || r.values.email || "Row";
      const list = batch.filter((r) => failures[r.id]).map((r) => ({ row: label(r), message: failures[r.id] }));
      // Saved rows leave the table (and so the draft); failed rows stay with their reason so they can be fixed and sent again.
      setDrafts((d) => ({ ...d, [target]: withSpareRow(d[target].filter((r) => !saved.includes(r.id)), BULK_SPECS[target]) }));
      setFailed(failures);
      setSummary({ saved: saved.length, failures: list, type: target });
      if (list.length === 0) toast.show(`Uploaded ${saved.length} ${saved.length === 1 ? one : many}.`);
      else toast.show(`${saved.length} uploaded, ${list.length} failed. The failed rows stay in the table.`, "danger");
    }
    setAttempted(false);
    setUploading(false);
    busy.current = false;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Bulk Upload" />
        <section className="rounded-2xl border border-border bg-surface">
          <EmptyState title="Admins only" description="Only an Admin can upload records in bulk. Ask an administrator if you need access changed." />
        </section>
      </div>
    );
  }

  const [one, many] = NOUN[type];
  const enteredIn = (t: BulkType) => drafts[t].filter((r) => !BULK_SPECS[t].columns.every((c) => (r.values[c.key] ?? "") === (BULK_SPECS[t].blank()[c.key] ?? ""))).length;

  return (
    <div className="flex flex-col gap-6 pb-32">
      <PageHeader
        title="Bulk Upload"
        description="Enter several records in a table and save them in one go. Choose what you are uploading with the tabs. Your entries are kept as a draft on this device until you submit them."
        actions={
          <div className="flex items-center gap-3">
            <span role="status" aria-live="polite" className={`text-xs font-medium ${saveStatus === "Save failed" ? "text-danger" : "text-muted"}`}>
              {saveStatus}
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted">
              Auto-Save
              <button
                type="button"
                role="switch"
                aria-checked={autoSave}
                aria-label="Auto-Save draft"
                onClick={toggleAutoSave}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${autoSave ? "bg-accent" : "bg-border"}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${autoSave ? "translate-x-4" : ""}`} />
              </button>
            </label>
          </div>
        }
      />

      <div
        role="tablist"
        aria-label="Upload type"
        className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1 sm:flex sm:w-fit sm:max-w-full"
      >
        {BULK_TYPES.map((t) => {
          const on = t.value === type;
          const count = enteredIn(t.value);
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`bulk-tab-${t.value}`}
              aria-selected={on}
              aria-controls="bulk-panel"
              disabled={uploading}
              onClick={() => setType(t.value)}
              className={`flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 ${
                on ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"
              }`}
            >
              <span className="truncate">{t.label}</span>
              {count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${on ? "bg-[#425df3] font-semibold text-white dark:bg-accent dark:text-accent-foreground" : "bg-hover text-muted"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="-mt-3 text-xs text-muted">{spec.hint}</p>

      <section id="bulk-panel" role="tabpanel" aria-labelledby={`bulk-tab-${type}`} className="flex flex-col gap-4" aria-label={`${spec.label} upload`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            <span className="font-semibold text-foreground tabular-nums">{filled.length}</span> {filled.length === 1 ? one : many} entered
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden aria-label="Excel file to import" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" onClick={() => void runExcel(() => downloadTemplate(type, ctx))} disabled={uploading || excelBusy} className={secondaryButton}>
              Download Excel Template
            </button>
            <button type="button" onClick={pickFile} disabled={uploading || excelBusy} className={secondaryButton}>
              Upload Excel
            </button>
            <button
              type="button"
              onClick={addRow}
              disabled={uploading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <PlusIcon width={16} height={16} /> Add Row
            </button>
            <button
              type="button"
              onClick={() => setClearing(true)}
              disabled={uploading || filled.length === 0}
              className="inline-flex h-10 items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-accent"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={uploading}
              className="btn-brand inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <UploadIcon width={16} height={16} />
              {uploading ? "Uploading…" : "Submit"}
            </button>
          </div>
        </div>

        {excelError && <FieldError>{excelError}</FieldError>}
        {problemCount > 0 && (
          <FieldError>
            {problemCount} {problemCount === 1 ? "cell needs" : "cells need"} fixing in {Object.keys(problems).length} {Object.keys(problems).length === 1 ? "row" : "rows"}. They are marked in red.
          </FieldError>
        )}

        {summary && summary.type === type && summary.error && (
          <FieldError>
            <strong className="font-semibold">Nothing was uploaded.</strong> {summary.error} Your entries are kept so you can try again.
          </FieldError>
        )}
        {summary && summary.type === type && !summary.error && (
          <div className="flex flex-col gap-2" role="status">
            <p className="text-sm">
              <span className="font-semibold text-emerald-600 dark:text-emerald-300">{summary.saved} uploaded</span>
              {summary.failures.length > 0 && <span className="font-semibold text-danger"> · {summary.failures.length} failed</span>}
            </p>
            {summary.failures.map((f, i) => (
              <FieldError key={i}>
                <strong className="font-semibold">{f.row}:</strong> {f.message}
              </FieldError>
            ))}
          </div>
        )}

        <div data-bulk-table className="max-h-[32rem] overflow-auto rounded-2xl border border-border bg-surface">
          <table className="w-max min-w-full text-sm">
            <caption className="sr-only">{spec.label} records to upload</caption>
            <thead className="sticky top-0 z-10 border-b border-border bg-surface">
              <tr className="bg-background/60">
                <th scope="col" className={`${th} w-10 text-center`}>#</th>
                {spec.columns.map((c) => (
                  <th key={c.key} scope="col" className={th} style={{ minWidth: c.width }}>
                    {c.label}
                    {c.required && <span aria-hidden="true" className="text-danger"> *</span>}
                  </th>
                ))}
                {Object.keys(failed).length > 0 && <th scope="col" className={th} style={{ minWidth: 240 }}>Result</th>}
                <th scope="col" className={`${th} sticky right-0 z-20 w-16 border-l border-border bg-surface text-center`}><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, index) => (
                <tr key={row.id} className="align-top">
                  <td className="px-2 py-2 text-center text-xs tabular-nums text-muted">{index + 1}</td>
                  {spec.columns.map((c) => {
                    const message = problems[row.id]?.[c.key];
                    return (
                      <td key={c.key} className="px-1.5 py-1.5" style={{ minWidth: c.width }}>
                        <Cell column={c} row={row} index={index} ctx={ctx} invalid={!!message} disabled={uploading} onChange={(v) => edit(row, c, v)} onLeave={(v) => c.complete && v !== c.complete(v) && edit(row, c, c.complete(v))} onCreate={c.create ? () => setCreating({ kind: c.create!, rowId: row.id, key: c.key, multi: c.control === "multi" }) : undefined} />
                        {message && <p className="mt-1 text-[11px] leading-snug text-danger">{message}</p>}
                      </td>
                    );
                  })}
                  {Object.keys(failed).length > 0 && <td className="px-2 py-2 text-xs leading-snug text-danger">{failed[row.id] ?? ""}</td>}
                  {/* Always in the same place: the last column sticks to the right edge, whatever the table is scrolled to. */}
                  <td className="sticky right-0 z-[5] w-16 border-l border-border bg-surface px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={uploading}
                      aria-label={`Remove row ${index + 1}`}
                      className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <CloseIcon width={18} height={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {creating?.kind === "owner" && (
        <CreateOwnerDrawer
          showRole={false}
          onClose={() => setCreating(null)}
          onCreated={(name) => {
            const record = useBacklogStore.getState().owners.find((o) => o.name === name);
            if (record) assign(creating.rowId, creating.key, false, record.id);
          }}
        />
      )}
      {creating?.kind === "member" && (
        <UserFormDrawer
          ownerMode
          onClose={() => setCreating(null)}
          onSaved={() => refreshUsers(true)}
          onCreated={(u) => assign(creating.rowId, creating.key, creating.multi, u.id)}
        />
      )}

      {importing && (
        <BacklogDrawer
          heading="Import from Excel"
          submitLabel="Replace existing rows"
          compact
          danger
          onSubmit={() => applyImport(importing.tab, importing.rows, "replace")}
          onClose={() => setImporting(null)}
        >
          <p className="text-sm">
            The file has <strong className="font-semibold">{importing.rows.length}</strong> {importing.rows.length === 1 ? NOUN[importing.tab][0] : NOUN[importing.tab][1]}, and the {BULK_SPECS[importing.tab].label} table already has{" "}
            <strong className="font-semibold">{drafts[importing.tab].filter((r) => !isBlankValues(importing.tab, r.values)).length}</strong> entered. Nothing is sent to the server either way.
          </p>
          <button
            type="button"
            onClick={() => {
              applyImport(importing.tab, importing.rows, "append");
              setImporting(null);
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
          >
            Add to the existing rows instead
          </button>
        </BacklogDrawer>
      )}

      {clearing && (
        <BacklogDrawer
          heading={`Clear ${spec.label} entries`}
          submitLabel="Clear all"
          compact
          danger
          onSubmit={clearAll}
          onClose={() => setClearing(false)}
        >
          <p className="text-sm">
            This removes all <strong className="font-semibold">{filled.length}</strong> {filled.length === 1 ? one : many} you have entered on the {spec.label} tab. Nothing has been saved yet, and the other tabs are not touched.
          </p>
        </BacklogDrawer>
      )}

      {confirming && (
        <BacklogDrawer
          heading="Confirm upload"
          submitLabel={`Upload ${filled.length} ${filled.length === 1 ? one : many}`}
          compact
          onSubmit={() => {
            void upload();
          }}
          onClose={() => setConfirming(false)}
        >
          <p className="text-sm">
            You are about to create <strong className="font-semibold">{filled.length}</strong> {filled.length === 1 ? one : many}. They are saved one at a time, and any that the server refuses stay in the table with the reason.
          </p>
          <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-xl border border-border text-sm">
            {filled.map((r, i) => (
              <Fragment key={r.id}>
                <li className="px-3 py-1.5">
                  <span className="mr-2 text-xs tabular-nums text-muted">{i + 1}</span>
                  {r.values.title || r.values.name || r.values.email}
                </li>
              </Fragment>
            ))}
          </ul>
        </BacklogDrawer>
      )}
    </div>
  );
}

/** One cell: the control for its column (text, dropdown, date, or a comma-separated list of names). */
function Cell({ column: c, row, index, ctx, invalid, disabled, onChange, onLeave, onCreate }: { column: Column; row: Row; index: number; ctx: Ctx; invalid: boolean; disabled: boolean; onChange: (value: string) => void; onLeave: (value: string) => void; onCreate?: () => void }) {
  const value = row.values[c.key] ?? "";
  const label = `${c.label}, row ${index + 1}`;
  const locked = c.readOnly?.(ctx, row.values) ?? false;
  if (c.control === "pick" || c.control === "multi") {
    const choices = c.options?.(ctx) ?? [];
    const multi = c.control === "multi";
    const resolved = (multi ? tokens(value) : value ? [value] : []).map((t) => ({ t, o: resolveOne(choices, t) }));
    const selected = resolved.flatMap((r) => (r.o ? [r.o.value] : []));
    return (
      <CellPicker
        options={choices}
        selected={selected}
        display={resolved.map((r) => r.o?.label ?? `${r.t} (not found)`).join(", ")}
        multi={multi}
        emptyLabel={c.emptyLabel ?? "—"}
        ariaLabel={label}
        invalid={invalid}
        disabled={disabled}
        onSelect={(id) => onChange(multi ? (selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]).join(",") : id)}
        createLabel={c.create === "owner" ? "+ Create New Owner" : c.create === "member" ? "+ Create New Team Member" : undefined}
        onCreate={onCreate}
      />
    );
  }
  if (c.control === "select") {
    const opts = c.options?.(ctx) ?? [];
    const chosen = opts.find((o) => o.value === value);
    return (
      <CellPicker
        options={opts}
        selected={chosen ? [chosen.value] : []}
        display={chosen?.label ?? value}
        emptyLabel={c.required ? "Select…" : (c.emptyLabel ?? "—")}
        ariaLabel={label}
        invalid={invalid}
        disabled={disabled || locked}
        onSelect={onChange}
      />
    );
  }
  if (c.suggestions) {
    // Free text with suggestions (Team): the same dropdown, and text that is not in the list can be used as typed.
    return (
      <CellPicker
        options={c.suggestions(ctx).map((t) => ({ value: t, label: t }))}
        selected={value ? [value] : []}
        display={value}
        allowCustom
        emptyLabel={c.placeholder ?? "—"}
        ariaLabel={label}
        invalid={invalid}
        disabled={disabled}
        onSelect={onChange}
      />
    );
  }
  return (
    <input
      type={c.control === "date" ? "date" : "text"}
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value}
      readOnly={locked}
      disabled={disabled}
      placeholder={c.placeholder}
      onChange={(e) => {
        const input = e.target;
        const typed = c.format ? c.format(input.value) : input.value;
        onChange(input.value);
        // A domain added after a typed "@" is selected, so carrying on typing replaces it instead of following it.
        const next = c.typing ? c.typing(value, typed) : typed;
        if (next !== typed) requestAnimationFrame(() => input.setSelectionRange(typed.length, next.length));
      }}
      onBlur={(e) => onLeave(e.target.value)}
      className={inputClass}
    />
  );
}
