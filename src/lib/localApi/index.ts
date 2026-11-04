import { LocalApiError } from "./errors";
import type { BackupSummary } from "./backup";

export { LocalApiError };
export type { BackupSummary };

/**
 * The page's side of the shared storage. Every request the screens make goes to the server (POST /api/rpc), which answers it from the data every computer shares; the
 * session is an httpOnly cookie the browser sends by itself. Other computers' changes are noticed by asking the server, every few seconds, whether the data's revision moved.
 */
type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Rec = Record<string, unknown>;

const HEADERS = { "content-type": "application/json", "x-koinbx-client": "1" };
const UNREACHABLE = "Can't reach the KoinBX server. Check your connection and try again.";

// ---------- noticing other people's changes ----------

/** The revision of the data this page last knew about. A change this page made itself is taken in at once, so only other people's changes make the listeners run. */
let lastRev: string | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

const POLL_MS = 3000;

async function poll() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  try {
    const res = await fetch("/api/rpc/rev", { headers: { "x-koinbx-client": "1" }, cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return;
    const { rev } = (await res.json()) as { rev?: string };
    if (!rev || rev === lastRev) return;
    const first = lastRev === null;
    lastRev = rev;
    if (!first) listeners.forEach((l) => l());
  } catch {
    // offline for a moment: the next poll tries again
  }
}

/** Called when somebody else (another computer, browser or tab) changed the shared data; the changes made on this page are already on its screens. */
export function onExternalChange(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer && typeof window !== "undefined") {
    timer = setInterval(() => void poll(), POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    void poll();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}
const onVisible = () => {
  if (document.visibilityState === "visible") void poll();
};

// ---------- requests ----------

export async function localRequest<T = unknown>(method: Method, url: string, options: { params?: Rec; data?: unknown } = {}): Promise<{ data: T; status: number }> {
  let res: Response;
  try {
    res = await fetch("/api/rpc", { method: "POST", headers: HEADERS, body: JSON.stringify({ method, url, params: options.params, data: options.data }), cache: "no-store", credentials: "same-origin" });
  } catch {
    throw new LocalApiError(503, UNREACHABLE);
  }
  let body: { data?: T; error?: { status?: number; message?: string } } = {};
  try {
    body = await res.json();
  } catch {
    // not an answer of ours (a proxy page, a crash): reported below
  }
  if (!res.ok) throw new LocalApiError(body.error?.status ?? res.status, body.error?.message ?? (res.status >= 500 ? "The server could not answer. Try again in a moment." : UNREACHABLE));
  // Nobody else saved in between: this page is up to date with its own change. Otherwise the next poll finds the difference and the listeners run.
  const before = res.headers.get("x-rev-before");
  const after = res.headers.get("x-rev");
  if (after && (lastRev === null || lastRev === before)) lastRev = after;
  return { data: (body.data ?? null) as T, status: 200 };
}

// ---------- backup of the shared data (Super Admin) ----------

export async function exportDatabase(): Promise<{ text: string; summary: BackupSummary }> {
  return (await localRequest<{ text: string; summary: BackupSummary }>("GET", "/backup/export")).data;
}

/** Checks a backup file's text on the server; nothing is changed. */
export async function readBackup(text: string): Promise<{ summary: BackupSummary }> {
  return (await localRequest<{ summary: BackupSummary }>("POST", "/backup/check", { data: { text } })).data;
}

export async function restoreDatabase(text: string): Promise<BackupSummary> {
  return (await localRequest<BackupSummary>("POST", "/backup/restore", { data: { text } })).data;
}

// ---------- images ----------

/** Stores the file of an attachment whose details were just registered. */
export async function uploadImage(id: number, blob: Blob): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/blob/${id}`, { method: "PUT", headers: { "x-koinbx-client": "1", "content-type": blob.type || "application/octet-stream" }, body: blob, credentials: "same-origin" });
  } catch {
    throw new LocalApiError(503, UNREACHABLE);
  }
  if (!res.ok) throw new LocalApiError(res.status, ((await res.json().catch(() => ({}))) as { error?: { message?: string } }).error?.message ?? "The image could not be saved.");
}

/** An attachment's image, or `undefined` when the server has none. */
export async function downloadImage(id: number): Promise<Blob | undefined> {
  try {
    const res = await fetch(`/api/blob/${id}`, { headers: { "x-koinbx-client": "1" }, credentials: "same-origin" });
    return res.ok ? await res.blob() : undefined;
  } catch {
    return undefined;
  }
}
