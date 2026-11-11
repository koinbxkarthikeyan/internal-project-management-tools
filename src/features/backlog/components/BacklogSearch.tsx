type BacklogSearchProps = {
  value: string;
  onChange: (value: string) => void;
  /** Defaults to the backlog wording; other pages pass their own. */
  placeholder?: string;
  ariaLabel?: string;
};

export default function BacklogSearch({ value, onChange, placeholder = "Search title or owner…", ariaLabel = "Search backlog items" }: BacklogSearchProps) {
  return (
    <div className="relative min-w-0 flex-1 basis-48">
      <svg
        viewBox="0 0 24 24"
        width={16}
        height={16}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Esc leaves the box (keeping the typed filter) so single-key shortcuts work again.
          if (e.key === "Escape") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-keyshortcuts="/"
        title="Just start typing on this page to search, or press /"
        className="peer h-10 w-full field pl-8 pr-10 text-sm placeholder:text-muted"
      />
      {/* The shortcut, shown while the box is empty: typing anywhere on the page, or /, lands here. */}
      {!value && <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-[10px] font-medium text-muted peer-focus:hidden sm:inline">/</kbd>}
    </div>
  );
}
