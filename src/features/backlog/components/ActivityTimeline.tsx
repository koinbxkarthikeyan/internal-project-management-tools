import type { ActivityEntry, BacklogItemData } from "@/types/backlog";
import { formatActivityTime } from "../utils";

const hasTime = (v?: string) => !!v && /T\d{2}:\d{2}/.test(v);
const stamp = (a: ActivityEntry) => Date.parse(a.at ?? `${a.date}T00:00:00Z`) || 0;

/** Newest entry first (entries with the same time keep their later-recorded one on top). A copy; the original is not reordered. */
export function newestFirst(entries: readonly ActivityEntry[] | undefined): ActivityEntry[] {
  return (entries ?? []).map((entry, index) => ({ entry, index })).sort((x, y) => stamp(y.entry) - stamp(x.entry) || y.index - x.index).map((x) => x.entry);
}

/**
 * Who made the newest change, from the activity log, for when the task itself doesn't name its last updater. It counts only if that newest
 * entry carries a name and, when both have times, happened at the task's last-updated time (within 2 minutes), so it is never a guess.
 */
export function latestUpdater(entries: readonly ActivityEntry[] | undefined, updatedAt?: string): string | undefined {
  const newest = newestFirst(entries)[0];
  return newest?.by && isTheLastUpdate(newest, updatedAt) ? newest.by : undefined;
}

/** Is this entry the change the task's last-updated time refers to? (Always true when either has no time to compare.) */
function isTheLastUpdate(entry: ActivityEntry, updatedAt?: string): boolean {
  return !(hasTime(updatedAt) && hasTime(entry.at) && Math.abs(Date.parse(entry.at as string) - Date.parse(updatedAt as string)) > 2 * 60_000);
}

/** A task timestamp in the app's activity format, or "Not available" when the API sent none (a time is never made up). */
export function whenOrUnavailable(date?: string, at?: string): string {
  if (hasTime(at)) return formatActivityTime({ date: (at as string).slice(0, 10), at });
  return date ? formatActivityTime({ date: date.slice(0, 10) }) : "Not available";
}

/** The date list of a task's activity: entries only, newest first. */
export function ActivityList({ entries, className = "", compact = false, latestBy, updatedAt }: { entries: readonly ActivityEntry[] | undefined; className?: string; /** Names the newest entry when it names nobody itself (the task's last updater, if that entry is the last update). */ latestBy?: string; updatedAt?: string; /** A short list (room for the 3 newest entries) that scrolls inside itself. */ compact?: boolean }) {
  const rows = newestFirst(entries);
  if (rows.length === 0) return <p className="mt-1 text-sm text-muted">No activity recorded.</p>;
  return (
    <ul className={`mt-1 divide-y divide-border rounded-xl border border-border text-sm ${compact ? "max-h-[9.25rem] overflow-y-auto" : ""} ${className}`}>
      {rows.map((entry, i) => {
        const a = i === 0 && !entry.by && latestBy && isTheLastUpdate(entry, updatedAt) ? { ...entry, by: latestBy } : entry;
        return (
        <li key={i} className={`flex justify-between gap-3 px-3 ${compact ? "py-1.5" : "py-2"}`}>
          <span className="min-w-0 break-words">
            {a.text}
            {a.by && <span className="block text-xs text-muted">by {a.by}</span>}
          </span>
          <span className="shrink-0 text-xs text-muted">{formatActivityTime(a)}</span>
        </li>
        );
      })}
    </ul>
  );
}

/**
 * A task's history: when it was created and last updated (from the API's own timestamps, labelled apart from the log), then the
 * log itself with the newest entry first.
 */
export default function ActivityTimeline({ item, activity, compact = false }: { item: Pick<BacklogItemData, "created" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">; activity: readonly ActivityEntry[] | undefined; /** Smaller: a short activity list that scrolls (used in the Backlog form). */ compact?: boolean }) {
  const updatedBy = item.updatedBy ?? latestUpdater(activity, item.updatedAt);
  return (
    <section aria-label="Activity" className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      <dl className={`grid grid-cols-2 gap-3 rounded-xl border border-border bg-background/60 ${compact ? "px-3 py-2" : "p-3"}`}>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted">Created</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold">
            {whenOrUnavailable(item.created, item.createdAt)}
            {item.createdBy && <span className="block text-xs font-normal text-muted">by {item.createdBy}</span>}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-muted">Last updated</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold">
            {whenOrUnavailable(undefined, item.updatedAt)}
            {updatedBy && <span className="block text-xs font-normal text-muted">by {updatedBy}</span>}
          </dd>
        </div>
      </dl>
      <div>
        <p className="text-xs font-medium text-muted">Activity</p>
        <ActivityList entries={activity} compact={compact} latestBy={updatedBy} updatedAt={item.updatedAt} />
      </div>
    </section>
  );
}
