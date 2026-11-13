import { apiClient } from "@/lib/apiClient";
import { listFrom, rec } from "./mappers";

/** One person's own leave day in a sprint (`hours` absent = the whole day). */
export type PersonalLeave = { id: string; sprintId: string; userId: string; date: string; hours?: number };

const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : typeof v === "string" && Number(v) > 0 ? Number(v) : undefined);

function fromApi(raw: unknown, sprintId: string, me: string): PersonalLeave | null {
  const r = rec(raw);
  const date = typeof r?.date === "string" ? r.date.slice(0, 10) : "";
  if (!r || !date || r.id === undefined) return null;
  return { id: String(r.id), sprintId: String(r.sprintId ?? sprintId), userId: String(r.userId ?? r.user_id ?? me), date, ...(num(r.hours) ? { hours: num(r.hours) } : {}) };
}

/** `GET /work-entries/leaves?sprintId=`: the leave days of the signed-in person in one sprint (closed sprints are read-only history). */
export async function getLeaves(sprintId: string, me: string): Promise<PersonalLeave[]> {
  const { data } = await apiClient.get<unknown>("/work-entries/leaves", { params: { sprintId: Number(sprintId) } });
  return listFrom(data, "leaves").flatMap((r) => fromApi(r, sprintId, me) ?? []);
}

/** `POST /work-entries/leaves`: one day (a working day inside the sprint); `hours` leaves out the whole day. */
export async function addLeave(sprintId: string, date: string, hours?: number): Promise<void> {
  await apiClient.post("/work-entries/leaves", { sprintId: Number(sprintId), date, ...(hours ? { hours } : {}) });
}

/** `DELETE /work-entries/leaves/:id` */
export async function removeLeave(id: string): Promise<void> {
  await apiClient.delete(`/work-entries/leaves/${encodeURIComponent(id)}`);
}
