/**
 * The one Expand / Shrink control used by every form, panel and dialog that can grow: an icon, the word (when there is room) and the shortcut (Ctrl F expands, Esc shrinks).
 * The shortcut itself is handled by the parent, which owns the dialog.
 */
export default function ExpandToggle({ expanded, onToggle, label = true, className = "" }: { expanded: boolean; onToggle: () => void; label?: boolean; className?: string }) {
  const text = expanded ? "Shrink" : "Expand";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={expanded}
      aria-keyshortcuts="Control+F"
      title={expanded ? "Shrink (Esc)" : "Expand to a larger view (Ctrl + F)"}
      className={`items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent ${className || "flex"}`}
    >
      <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {expanded ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
      </svg>
      {label ? <span>{text}</span> : <span className="sr-only">{text}</span>}
      <kbd className="hidden rounded border border-border px-1 text-[10px] font-medium sm:inline">{expanded ? "Esc" : "Ctrl F"}</kbd>
    </button>
  );
}
