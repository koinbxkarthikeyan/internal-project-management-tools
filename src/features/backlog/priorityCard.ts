import type { Priority } from "@/types/backlog";

/** A card's background and border follow its priority with the same hues as the priority badges (Critical red, High orange, Medium yellow, Low green), kept to a faint pastel tint and a soft border; hover only deepens them a little. The same on every board, in both themes. Not set stays plain. */
export const PRIORITY_CARD: Record<Priority, string> = {
  Critical: "[--flash:var(--color-red-500)] border-red-500/20 bg-red-500/[0.05] hover:border-red-500/35 hover:bg-red-500/[0.09]",
  High: "[--flash:var(--color-orange-500)] border-orange-500/20 bg-orange-500/[0.05] hover:border-orange-500/35 hover:bg-orange-500/[0.09]",
  Medium: "[--flash:var(--color-yellow-500)] border-yellow-500/25 bg-yellow-500/[0.06] hover:border-yellow-500/40 hover:bg-yellow-500/[0.10]",
  Low: "[--flash:var(--color-green-500)] border-green-500/20 bg-green-500/[0.05] hover:border-green-500/35 hover:bg-green-500/[0.09]",
  "Not set": "[--flash:var(--accent)] border-border bg-background hover:border-muted hover:bg-row-hover",
};

/** The same priority tint for a table row (background only: a row has no border of its own), so lists and boards agree. */
export const PRIORITY_ROW: Record<Priority, string> = {
  Critical: "[--flash:var(--color-red-500)] bg-red-500/[0.05] hover:bg-red-500/[0.09]",
  High: "[--flash:var(--color-orange-500)] bg-orange-500/[0.05] hover:bg-orange-500/[0.09]",
  Medium: "[--flash:var(--color-yellow-500)] bg-yellow-500/[0.06] hover:bg-yellow-500/[0.10]",
  Low: "[--flash:var(--color-green-500)] bg-green-500/[0.05] hover:bg-green-500/[0.09]",
  "Not set": "[--flash:var(--accent)] hover:bg-row-hover",
};
