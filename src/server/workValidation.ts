import { HttpError } from "@/server/db";
import type { WorkEntryInput } from "@/types/work";

const KINDS = ["Backend", "Frontend", "Mobile", "Testing", "Design"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a full or partial work entry; throws HttpError(400) on bad input. */
export function validateWorkEntry(entry: Partial<WorkEntryInput>, partial = false) {
  const need = (ok: boolean, message: string) => {
    if (!ok) throw new HttpError(400, message);
  };
  const has = (k: keyof WorkEntryInput) => !partial || entry[k] !== undefined;

  if (has("sprintId")) need(!!entry.sprintId?.trim(), "Sprint is required");
  if (has("person")) need(!!entry.person?.trim(), "Person is required");
  if (has("pod")) need(!!entry.pod?.trim(), "POD is required");
  if (has("task")) need(!!entry.task?.trim(), "Task name is required");
  if (has("kind")) need(KINDS.includes(entry.kind as string), "Kind of work is invalid");
  if (has("from")) need(ISO.test(entry.from ?? ""), "From date is invalid");
  if (has("to")) need(ISO.test(entry.to ?? ""), "To date is invalid");
  if (has("hours")) need(typeof entry.hours === "number" && entry.hours > 0 && entry.hours <= 1000, "Hours must be greater than 0");
  if (entry.itemIds !== undefined) {
    need(Array.isArray(entry.itemIds) && entry.itemIds.every((i) => typeof i === "string"), "Tasks are invalid");
  }
  if (entry.from && entry.to) need(entry.to >= entry.from, "To date can't be before From date");
}
