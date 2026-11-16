import type { Priority } from "@/types/backlog";

/**
 * The faint tint a task's row takes from its priority (about 5% of the priority colour as the fill, about 9% on hover), so lists agree with the priority badge: red, orange, blue, teal.
 * "Not set" keeps the plain row. The class names are written out in full on purpose: the stylesheet is built from the names found in the source, so a name made up at run time would get no style.
 */
export const PRIORITY_ROW: Record<Priority, string> = {
  Critical: "bg-[color-mix(in_srgb,#dc2626_5%,transparent)] hover:bg-[color-mix(in_srgb,#dc2626_9%,transparent)]",
  High: "bg-[color-mix(in_srgb,#f97316_5%,transparent)] hover:bg-[color-mix(in_srgb,#f97316_9%,transparent)]",
  Medium: "bg-[color-mix(in_srgb,#2563eb_5%,transparent)] hover:bg-[color-mix(in_srgb,#2563eb_9%,transparent)]",
  Low: "bg-[color-mix(in_srgb,#0d9488_5%,transparent)] hover:bg-[color-mix(in_srgb,#0d9488_9%,transparent)]",
  "Not set": "hover:bg-row-hover",
};
