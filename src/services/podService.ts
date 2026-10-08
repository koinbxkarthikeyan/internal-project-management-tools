import { apiClient } from "@/lib/apiClient";
import type { Pod, PodInput, PodPatch } from "@/types/work";
import { directory, listFrom, rec } from "./mappers";

function podFrom(raw: unknown): Pod {
  const p = rec(raw) ?? {};
  return { id: String(p.id), name: String(p.name ?? ""), ...(p.hidden ? { hidden: true } : {}) };
}

/** Every POD including hidden ones; the screens filter the hidden ones out of lists and choices. */
export async function getPods(): Promise<Pod[]> {
  const { data } = await apiClient.get<unknown>("/pods", { params: { includeHidden: true } });
  const pods = listFrom(data, "pods").map(podFrom);
  directory.pods = pods;
  return pods;
}

/** Re-adding the name of a hidden POD restores that POD (the backend decides). */
export async function createPod(input: PodInput): Promise<Pod> {
  const { data } = await apiClient.post<unknown>("/pods", input);
  const pod = podFrom(data);
  directory.pods = [...directory.pods.filter((p) => p.id !== pod.id), pod];
  return pod;
}

/** Renames a POD, or hides / unhides it. PODs are never deleted. */
export async function updatePod(id: string, input: PodPatch): Promise<Pod> {
  const { data } = await apiClient.patch<unknown>(`/pods/${encodeURIComponent(id)}`, input);
  const current = directory.pods.find((p) => p.id === id);
  const merged = podFrom({ ...current, ...input, ...(rec(data) ?? {}), id });
  // A hidden flag the backend left out of its answer is taken from what was asked.
  const pod: Pod = input.hidden === false ? { id: merged.id, name: merged.name } : input.hidden === true ? { ...merged, hidden: true } : merged;
  directory.pods = directory.pods.map((p) => (p.id === pod.id ? pod : p));
  return pod;
}
