/**
 * Before the app had shared storage, each browser kept its own copy of the data (one JSON document in localStorage, the attachment images in IndexedDB). This reads that copy
 * (it is never changed or deleted here) so it can be moved once to the shared server (POST /api/import), which accepts it only while the server has no users.
 */
const DB_KEY = "koinbx.local.db.v1";
const IMAGE_DB = "koinbx-attachments";
const IMAGE_STORE = "files";

export type LegacySummary = { users: number; tasks: number; images: number };
export type LegacyData = { summary: LegacySummary; payload: { db: unknown; files: { id: number; base64: string }[] } };

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** The image files of this browser by attachment id (none when it never stored any). */
async function readImages(ids: number[]): Promise<{ id: number; base64: string }[]> {
  if (ids.length === 0 || typeof indexedDB === "undefined") return [];
  const opened = await new Promise<IDBDatabase | null>((resolve) => {
    const req = indexedDB.open(IMAGE_DB);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  if (!opened) return [];
  try {
    if (!opened.objectStoreNames.contains(IMAGE_STORE)) return [];
    const out: { id: number; base64: string }[] = [];
    for (const id of ids) {
      const stored = await new Promise<unknown>((resolve) => {
        const req = opened.transaction(IMAGE_STORE, "readonly").objectStore(IMAGE_STORE).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
      });
      const blob = stored instanceof Blob ? stored : (stored as { blob?: Blob } | undefined)?.blob;
      if (blob instanceof Blob) out.push({ id, base64: await toBase64(blob) });
    }
    return out;
  } finally {
    opened.close();
  }
}

/** This browser's old data, or `null` when it has none (no users). */
export async function readLegacyData(): Promise<LegacyData | null> {
  let db: { version?: number; users?: unknown[]; items?: unknown[]; attachments?: { id: number }[] } | null = null;
  try {
    const text = localStorage.getItem(DB_KEY);
    db = text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
  if (!db || db.version !== 1 || !Array.isArray(db.users) || db.users.length === 0) return null;
  const files = await readImages((db.attachments ?? []).map((a) => a.id));
  return { summary: { users: db.users.length, tasks: (db.items ?? []).length, images: files.length }, payload: { db, files } };
}

/** Sends the data to the server. It is refused (409) when the server already has users, so it can't overwrite or duplicate anything. */
export async function importLegacyData(data: LegacyData): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json", "x-koinbx-client": "1" }, body: JSON.stringify(data.payload), credentials: "same-origin" });
  } catch {
    throw new Error("Can't reach the KoinBX server. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: { message?: string } }).error?.message ?? "The data could not be imported.");
}
