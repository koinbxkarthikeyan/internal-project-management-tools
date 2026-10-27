import { BULK_SPECS, type BulkType, type Values } from "./bulkSpecs";

/**
 * The Bulk Upload draft kept in this browser: what has been typed in each tab, and which tab was open. It is only ever a local copy of the
 * table's cells (names, titles, emails...): there is no password, token or id in it, it lives under its own key for each signed-in user, and
 * nothing here sends anything anywhere. Reading is defensive (the stored text may be old, edited or damaged), writing reports failure.
 */
export type DraftSnapshot = { tab: BulkType; rows: Record<BulkType, Values[]> };

const VERSION = 1;
const MAX_ROWS = 500;
const MAX_TEXT = 2000;
const TYPES: BulkType[] = ["backlog", "owner", "users"];

const draftKey = (userId: string) => `koinbx.bulk-draft.v${VERSION}:${userId}`;
const PREF_KEY = "koinbx.bulk-autosave.v1";

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Only the table's own columns, only text, only up to a sane length. */
function cleanValues(type: BulkType, raw: unknown): Values | null {
  if (!isRecord(raw)) return null;
  const out: Values = {};
  for (const col of BULK_SPECS[type].columns) {
    // A fixed column (the Backlog tab's Status) is never read back from storage: a draft saved before it was renamed ("Backlog" -> "To Do") would otherwise make an empty row look filled in.
    if (col.excel === false) {
      out[col.key] = BULK_SPECS[type].blank()[col.key] ?? "";
      continue;
    }
    const v = raw[col.key];
    if (typeof v === "string") out[col.key] = v.slice(0, MAX_TEXT);
  }
  return out;
}

/** A row with nothing entered (only the table's own defaults) is not part of a draft. */
export function isBlankValues(type: BulkType, values: Values): boolean {
  const blank = BULK_SPECS[type].blank();
  return BULK_SPECS[type].columns.every((c) => (values[c.key] ?? "") === (blank[c.key] ?? ""));
}

/** The draft stored for this user, or null when there is none (or it cannot be trusted). Never throws. */
export function loadDraft(userId: string): DraftSnapshot | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.v !== VERSION || !isRecord(data.rows)) return null;
    const rows = { backlog: [], owner: [], users: [] } as Record<BulkType, Values[]>;
    for (const type of TYPES) {
      const list = data.rows[type];
      if (!Array.isArray(list)) continue;
      rows[type] = list
        .slice(0, MAX_ROWS)
        .map((r) => cleanValues(type, r))
        .filter((v): v is Values => !!v && !isBlankValues(type, v));
    }
    const tab = TYPES.includes(data.tab as BulkType) ? (data.tab as BulkType) : "backlog";
    return { tab, rows };
  } catch {
    return null;
  }
}

/** The text that identifies a snapshot (blank rows left out), used to tell whether anything changed since the last save. */
export function snapshotKey(s: DraftSnapshot): string {
  const rows = { backlog: [], owner: [], users: [] } as Record<BulkType, Values[]>;
  for (const type of TYPES) rows[type] = s.rows[type].filter((v) => !isBlankValues(type, v));
  return JSON.stringify({ tab: s.tab, rows });
}

const hasData = (s: DraftSnapshot) => TYPES.some((t) => s.rows[t].some((v) => !isBlankValues(t, v)));

/** Stores the snapshot (or removes the draft when there is nothing left in it). Returns false when the browser would not store it. */
export function saveDraft(userId: string, key: string): boolean {
  if (!userId) return false;
  try {
    const snapshot = JSON.parse(key) as DraftSnapshot;
    if (!hasData(snapshot)) {
      localStorage.removeItem(draftKey(userId));
      return true;
    }
    localStorage.setItem(draftKey(userId), JSON.stringify({ v: VERSION, savedAt: Date.now(), tab: snapshot.tab, rows: snapshot.rows }));
    return true;
  } catch {
    return false;
  }
}

/** Auto-Save is on unless the person turned it off (a preference, kept apart from the draft). */
export function loadAutoSavePref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveAutoSavePref(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    // the choice then lasts for this visit only
  }
}
