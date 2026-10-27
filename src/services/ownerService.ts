import { apiClient } from "@/lib/apiClient";
import type { Owner, OwnerInput, OwnerUpdate } from "@/types/backlog";
import { directory, listFrom, rec } from "./mappers";

const UNASSIGNED: Owner = { id: "unassigned", name: "Unassigned" };

function ownerFrom(raw: unknown): Owner {
  const o = rec(raw) ?? {};
  return {
    id: String(o.id),
    name: String(o.name ?? ""),
    ...(typeof o.role === "string" && o.role ? { role: o.role } : {}),
    ...(typeof o.team === "string" && o.team ? { team: o.team } : {}),
  };
}

/** The owner records with the built-in "Unassigned" last (tasks without an owner show under it). Owners are not users. */
export const withUnassigned = (owners: readonly Owner[]): Owner[] => [...owners, UNASSIGNED];

/** The backend's owner records (`/owners`): their ids are what a task's `ownerId` refers to. */
export async function getOwners(): Promise<Owner[]> {
  const { data } = await apiClient.get<unknown>("/owners");
  const owners = listFrom(data, "owners").map(ownerFrom);
  directory.owners = owners;
  return owners;
}

export async function createOwner(input: OwnerInput): Promise<Owner> {
  const { data } = await apiClient.post<unknown>("/owners", input);
  const owner = ownerFrom(data);
  directory.owners = [...directory.owners, owner];
  return owner;
}

/** Renaming an owner also renames them on their tasks (the backend does it). */
export async function updateOwner(id: string, input: OwnerUpdate): Promise<Owner> {
  const { data } = await apiClient.patch<unknown>(`/owners/${encodeURIComponent(id)}`, input);
  const owner = ownerFrom({ ...input, ...(rec(data) ?? {}), id });
  directory.owners = directory.owners.map((o) => (o.id === owner.id ? owner : o));
  return owner;
}

/** Deleting an owner moves their tasks to "Unassigned" (the backend does it). */
export async function deleteOwner(id: string): Promise<void> {
  await apiClient.delete(`/owners/${encodeURIComponent(id)}`);
  directory.owners = directory.owners.filter((o) => o.id !== id);
}
