export type BacklogView = "visible" | "hidden";

type BacklogViewTabsProps = {
  view: BacklogView;
  onChange: (view: BacklogView) => void;
  counts: Record<BacklogView, number>;
};

const TABS: { id: BacklogView; label: string }[] = [
  { id: "visible", label: "Visible" },
  { id: "hidden", label: "Hidden" },
];

export default function BacklogViewTabs({ view, onChange, counts }: BacklogViewTabsProps) {
  return (
    <div role="group" aria-label="View" className="inline-flex rounded-xl border border-border bg-surface p-1">
      {TABS.map((t) => {
        const active = view === t.id;
        // An empty Hidden list can't be opened.
        const disabled = !active && counts[t.id] === 0;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            title={disabled ? "No hidden items" : undefined}
            onClick={() => onChange(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              active
                ? "bg-accent-soft font-medium text-accent"
                : disabled
                  ? "cursor-not-allowed text-muted opacity-50"
                  : "text-muted hover:bg-hover hover:text-foreground"
            }`}
          >
            {t.label} <span className="tabular-nums">({counts[t.id]})</span>
          </button>
        );
      })}
    </div>
  );
}
