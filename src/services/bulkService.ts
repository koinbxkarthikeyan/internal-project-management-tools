import { apiClient, getErrorMessage } from "@/lib/apiClient";
import { list, rec } from "./mappers";

/**
 * The Bulk Upload calls: one request per tab, to the route for that tab, answered by the local data layer (src/lib/localApi/handlers/bulk.ts).
 *  - Request: the body is `{ rows: [...] }`, one record per row, each exactly as the matching single-create call sends it (POST /items, /owners, /users), in row order,
 *    at most 200 rows per request.
 *  - Response: `{ results: [...] }`, one result per row in the same order; a row that was refused has `success: false` and a `message`. The other rows are saved.
 */
export type BulkKind = "backlog" | "owner" | "users";

export const BULK_ENDPOINTS: Record<BulkKind, string> = {
  backlog: "/bulk/backlog",
  owner: "/bulk/owners",
  users: "/bulk/users",
};

/** What happened to the rows that were sent, by their position in the request. */
export type BulkOutcome = { failed: { index: number; message: string }[] };

const textOf = (v: unknown): string | undefined => (typeof v === "string" && v ? v : Array.isArray(v) && v.length ? v.map(String).join(". ") : undefined);

function failureOf(item: unknown): string | undefined {
  const r = rec(item);
  if (!r) return undefined;
  const bad = r.success === false || r.ok === false || !!r.error || (Array.isArray(r.errors) && r.errors.length > 0) || (typeof r.statusCode === "number" && r.statusCode >= 400) || (typeof r.status === "string" && /^(fail|error)/i.test(r.status));
  return bad ? (textOf(r.message) ?? textOf(r.error) ?? textOf(r.errors) ?? "This row could not be saved.") : undefined;
}

/** Reads what the server said about each row. An answer it cannot read as a failure list means every row was saved (it was a 2xx). */
export function readOutcome(data: unknown, sent: number): BulkOutcome {
  const perRow = Array.isArray(data) ? data : list(rec(data)?.results);
  if (perRow.length === sent && sent > 0) {
    return { failed: perRow.flatMap((item, index) => (failureOf(item) ? [{ index, message: failureOf(item) as string }] : [])) };
  }
  const listed = [rec(data)?.failed, rec(data)?.failures, rec(data)?.errors].find((v) => Array.isArray(v) && v.length > 0);
  if (Array.isArray(listed)) {
    return {
      failed: listed.flatMap((entry) => {
        const e = rec(entry);
        const index = Number(e?.index ?? e?.row ?? e?.rowIndex);
        return Number.isInteger(index) && index >= 0 && index < sent ? [{ index, message: textOf(e?.message) ?? textOf(e?.error) ?? "This row could not be saved." }] : [];
      }),
    };
  }
  return { failed: [] };
}

/** The most rows the backend accepts in one request. */
export const BULK_MAX_ROWS = 200;
/** The fewest filled records a bulk upload may be submitted with. */
export const BULK_MIN_ROWS = 2;

/**
 * Sends the rows of one tab as `{ rows: [...] }`, in requests of at most BULK_MAX_ROWS. Rejects (with the server's message) when the first request fails,
 * in which case nothing is to be treated as saved. If a later request fails, the rows of it and of the ones after it are reported as failed instead.
 */
export async function submitBulk(kind: BulkKind, records: readonly unknown[]): Promise<BulkOutcome> {
  if (records.length === 0) throw new Error("Add at least one row.");
  const failed: BulkOutcome["failed"] = [];
  for (let start = 0; start < records.length; start += BULK_MAX_ROWS) {
    const rows = records.slice(start, start + BULK_MAX_ROWS);
    try {
      const { data } = await apiClient.post<unknown>(BULK_ENDPOINTS[kind], { rows });
      for (const f of readOutcome(data, rows.length).failed) failed.push({ index: start + f.index, message: f.message });
    } catch (err) {
      if (start === 0) throw err;
      const message = getErrorMessage(err);
      for (let i = start; i < records.length; i++) failed.push({ index: i, message });
      break;
    }
  }
  return { failed };
}
