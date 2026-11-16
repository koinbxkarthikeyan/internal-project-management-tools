import { apiClient } from "@/lib/apiClient";
import { rec } from "./mappers";

/** One person's own leave day in a sprint (`hours` absent = the whole day). */
export type PersonalLeave = { id: string; sprintId: string; userId: string; date: string; hours?: number };

const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : typeof v === "string" && Number(v) > 0 ? Number(v) : undefined);

function fromApi(raw: unknown, sprintId: string, me: string): PersonalLeave | null {
  const r = rec(raw);
  const raw_date = r?.date ?? r?.leaveDate ?? r?.day;
  const date = typeof raw_date === "string" ? raw_date.slice(0, 10) : "";
  if (!r || !date) return null;
  return { id: String(r.id ?? r.leaveId ?? date), sprintId: String(r.sprintId ?? sprintId), userId: String(r.userId ?? r.user_id ?? me), date, ...(num(r.hours) ? { hours: num(r.hours) } : {}) };
}

/** The signed-in person's own leave days in one sprint, from the `leave.mine` list of `GET /work-entries/my-sprint` (the sprint's common leave is the separate `leave.common`, so it never shows here). Closed sprints are read-only history. */
export async function getLeaves(sprintId: string, me: string): Promise<PersonalLeave[]> {
  const { data } = await apiClient.get<unknown>("/work-entries/my-sprint", { params: { sprintId: Number(sprintId) } });
  const mine = rec(rec(data)?.leave)?.mine;
  return (Array.isArray(mine) ? mine : []).flatMap((r) => fromApi(r, sprintId, me) ?? []);
}

/** `POST /work-entries/leaves`: one day (a working day inside the sprint); `hours` leaves out the whole day. */
export async function addLeave(sprintId: string, date: string, hours?: number): Promise<void> {
  await apiClient.post("/work-entries/leaves", { sprintId: Number(sprintId), date, ...(hours ? { hours } : {}) });
}

/** `DELETE /work-entries/leaves/:id` */
export async function removeLeave(id: string): Promise<void> {
  await apiClient.delete(`/work-entries/leaves/${encodeURIComponent(id)}`);
}
