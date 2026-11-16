/**
 * Today's calendar day (YYYY-MM-DD) in the people's own time zone, never UTC (in India UTC is still "yesterday" until 5:30 am). This is the one place that decides "today":
 * sprint start and end, the last day work can be logged, leave and expected hours, completion dates, the sprint that closes itself, and so on.
 *
 * In the browser it is the person's own time zone. On the server it is the zone in `KOINBX_TIMEZONE` (an IANA name such as `Asia/Kolkata`), or else the zone the server runs in.
 */
export function todayISO(now: Date = new Date(), timeZone?: string): string {
  const zone = timeZone ?? (typeof process !== "undefined" ? process.env?.KOINBX_TIMEZONE : undefined) ?? undefined;
  const format = (tz?: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(zone || undefined);
  } catch {
    // A misspelt zone name must not break the app: fall back to the zone the code runs in.
    parts = format(undefined);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
