export type WorkScope = "mine" | "everyone";

type ScopeTabsProps = {
  scope: WorkScope;
  onChange: (scope: WorkScope) => void;
};

const TABS: { id: WorkScope; label: string }[] = [
  { id: "mine", label: "Log Work Sprint" },
  { id: "everyone", label: "Everyone" },
];

export default function ScopeTabs({ scope, onChange }: ScopeTabsProps) {
  return (
    <div role="group" aria-label="Whose work" className="grid grid-cols-2 rounded-xl border border-border bg-surface p-1">
      {TABS.map((t) => {
        const active = scope === t.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t.id)}
            className={`rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
