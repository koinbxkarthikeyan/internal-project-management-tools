const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Formats an ISO date (YYYY-MM-DD) identically on server and client. */
export function formatDeadline(iso: string) {
  if (!iso) return "—";
  return dateFormat.format(new Date(`${iso}T00:00:00Z`));
}

const activityFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * "12 Oct 2026, 10:35 AM" for an activity entry, in the viewer's time zone. When the backend sent only a date there is
 * no time to show, so just the date is returned (a time is never made up).
 */
export function formatActivityTime(entry: { date: string; at?: string }): string {
  if (entry.at) {
    const d = new Date(entry.at);
    if (!Number.isNaN(d.getTime())) return activityFormat.format(d).replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
  }
  return entry.date ? formatDeadline(entry.date) : "";
}

const shortDateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatShortDate(iso: string) {
  return shortDateFormat.format(new Date(`${iso}T00:00:00Z`));
}

/** Today's date (YYYY-MM-DD) in the user's local time. */
export function todayISO() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function initials(name: string) {
  return name === "Unassigned"
    ? "?"
    : name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2);
}
