/**
 * The top-right corner of a task card: the number of Tickets linked to the task and, as a separate element, a bell with the task's unread notifications. They are never
 * one badge and each updates on its own (the count when Tickets are added or removed, the bell when notices are read).
 */
export default function TaskCardBadges({ tickets, unread, onBell }: { tickets?: number; unread: number; /** Clicking the bell opens the latest unread notification (and marks it read). */ onBell?: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {tickets !== undefined && (
      <span title={`${tickets} ${tickets === 1 ? "Ticket" : "Tickets"}`} className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${tickets > 0 ? "border-border bg-hover text-foreground" : "border-border text-muted"}`}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 0 0-6V6H3z" /></svg>
        <span aria-label={`${tickets} ${tickets === 1 ? "Ticket" : "Tickets"}`}>{tickets}</span>
      </span>
      )}
      {unread > 0 && onBell ? (
        <button type="button" onClick={(e) => (e.stopPropagation(), onBell())} title={`${unread} unread ${unread === 1 ? "notification" : "notifications"}: open the latest`} aria-label={`Open the latest of ${unread} unread ${unread === 1 ? "notification" : "notifications"}`} className="flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-500/25 focus-visible:outline-2 focus-visible:outline-accent dark:text-red-300">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
          <span>{unread}</span>
        </button>
      ) : (
        <span title={unread > 0 ? `${unread} unread ${unread === 1 ? "notification" : "notifications"}` : "No unread notifications"} className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${unread > 0 ? "bg-red-500/15 text-red-700 dark:text-red-300" : "border border-border text-muted"}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
          <span aria-label={`${unread} unread notifications`}>{unread}</span>
        </span>
      )}
    </span>
  );
}
