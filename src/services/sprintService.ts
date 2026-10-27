import { apiClient } from "@/lib/apiClient";
import type { Sprint, SprintInput } from "@/types/backlog";
import { directory, listFrom, rec, sprintFromApi } from "./mappers";

const UNPLANNED: Sprint = { id: "unplanned", name: "Unplanned" };

/**
 * All sprints, oldest first, with "Unplanned" last. The backend runs one sprint at a time; if it ever lists more than
 * one as running, only the newest counts as running here.
 */
export async function getSprints(): Promise<Sprint[]> {
  const { data } = await apiClient.get<unknown>("/sprints");
  const sprints = listFrom(data, "sprints").flatMap((r) => (rec(r) ? [sprintFromApi(rec(r)!)] : []));
  sprints.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "") || Number(a.id) - Number(b.id));
  const running = sprints.filter((s) => s.status === "Active");
  for (const s of running.slice(0, -1)) s.status = "Closed";
  directory.sprints = sprints;
  return [...sprints, UNPLANNED];
}

/** The end date is always start + 13 days, set by the backend, so only the start date is sent. */
export async function createSprint(input: SprintInput): Promise<Sprint> {
  const { data } = await apiClient.post<unknown>("/sprints", {
    name: input.name,
    ...(input.start ? { startDate: input.start } : {}),
    ...(input.goal ? { goal: input.goal } : {}),
  });
  const sprint = sprintFromApi(rec(data) ?? {});
  directory.sprints = [...directory.sprints, sprint];
  return sprint;
}

/** Changes name, start date or goal. `status: "Closed"` closes the sprint instead (the next sprint then waits as Paused). */
export async function updateSprint(id: string, patch: Partial<SprintInput>): Promise<Sprint> {
  if (patch.status === "Closed") {
    const { data } = await apiClient.post<unknown>(`/sprints/${encodeURIComponent(id)}/close`);
    const closed = sprintFromApi({ ...(rec(rec(data)?.closed) ?? { id }), status: "CLOSED" });
    directory.sprints = directory.sprints.map((s) => (s.id === id ? { ...s, ...closed } : s));
    return directory.sprints.find((s) => s.id === id) ?? closed;
  }
  const { data } = await apiClient.patch<unknown>(`/sprints/${encodeURIComponent(id)}`, {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.start ? { startDate: patch.start } : {}),
    ...(patch.goal !== undefined ? { goal: patch.goal } : {}),
  });
  const current = directory.sprints.find((s) => s.id === id);
  const sprint = { ...current, ...sprintFromApi({ id, ...(rec(data) ?? {}) }), id } as Sprint;
  directory.sprints = directory.sprints.map((s) => (s.id === id ? sprint : s));
  return sprint;
}

/** Starts (resumes) a Paused sprint; the backend allows only one running sprint at a time. */
export async function startSprint(id: string): Promise<Sprint> {
  const { data } = await apiClient.post<unknown>(`/sprints/${encodeURIComponent(id)}/start`);
  const current = directory.sprints.find((s) => s.id === id);
  const sprint = { ...current, ...sprintFromApi({ id, ...(rec(data) ?? {}), status: "ACTIVE" }), id } as Sprint;
  directory.sprints = directory.sprints.map((s) => (s.id === id ? sprint : s));
  return sprint;
}

/** Deleting a sprint moves its tasks to Unplanned and removes its time logs (the backend does both). */
export async function deleteSprint(id: string): Promise<void> {
  await apiClient.delete(`/sprints/${encodeURIComponent(id)}`);
  directory.sprints = directory.sprints.filter((s) => s.id !== id);
}
