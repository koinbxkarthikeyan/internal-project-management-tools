import { requireAdmin, type Req, type Rec } from "../core";
import { LocalApiError } from "../errors";
import { createItem } from "./items";
import { create as createUser } from "./users";
import { createOwner } from "./directory";
import { save } from "../db";

const MAX_ROWS = 200;

function rowsOf(data: Rec): Rec[] {
  const rows = data.rows;
  if (!Array.isArray(rows) || rows.length === 0) throw new LocalApiError(400, "Send at least one row.");
  if (rows.length > MAX_ROWS) throw new LocalApiError(400, `Send at most ${MAX_ROWS} rows at a time.`);
  return rows as Rec[];
}

/** Each row is saved on its own; one that is refused is reported with its reason and does not stop the others. */
async function each(data: Rec, make: (row: Rec) => unknown | Promise<unknown>) {
  const results: { success: boolean; message?: string }[] = [];
  for (const row of rowsOf(data)) {
    try {
      await make(row);
      results.push({ success: true });
    } catch (err) {
      results.push({ success: false, message: err instanceof Error ? err.message : "The row could not be saved." });
    }
  }
  return { results };
}

export async function backlog({ data }: Req) {
  const me = requireAdmin();
  const answer = await each(data, (row) => createItem(row, me));
  save();
  return answer;
}

export const owners = ({ data }: Req) => (requireAdmin(), each(data, (row) => createOwner({ params: {}, query: {}, data: row })));

export const users = ({ data }: Req) => (requireAdmin(), each(data, (row) => createUser({ params: {}, query: {}, data: row })));

