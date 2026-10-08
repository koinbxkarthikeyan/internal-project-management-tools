import BacklogSearch from "./BacklogSearch";

export type FilterState = {
  query: string;
  status: string;
  priority: string;
  owner: string;
  sprint: string;
  /** Deadline range, ISO dates (inclusive); empty = unbounded. */
  deadlineFrom: string;
  deadlineTo: string;
};

export const EMPTY_FILTERS: FilterState = {
  query: "",
  status: "",
  priority: "",
  owner: "",
  sprint: "",
  deadlineFrom: "",
  deadlineTo: "",
};

type BacklogFiltersProps = {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  options: {
    status: readonly string[];
    priority: readonly string[];
    owner: readonly string[];
    sprint: readonly string[];
  };
};

const SELECTS = [
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "owner", label: "Owner" },
  { key: "sprint", label: "Sprint" },
] as const;

const DATES = [
  { key: "deadlineFrom", label: "Due from" },
  { key: "deadlineTo", label: "to" },
] as const;

export default function BacklogFilters({ filters, onChange, options }: BacklogFiltersProps) {
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <section
      aria-label="Search and filters"
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-2.5"
    >
      <BacklogSearch
        value={filters.query}
        onChange={(query) => onChange({ ...filters, query })}
      />
      {SELECTS.map(({ key, label }) => (
        <select
          key={key}
          aria-label={`Filter by ${label.toLowerCase()}`}
          value={filters[key]}
          onChange={(e) => onChange({ ...filters, [key]: e.target.value })}
          className="h-9 min-w-0 flex-1 basis-32 rounded-lg border border-border bg-surface px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-accent sm:flex-none"
        >
          <option value="">{label}: All</option>
          {options[key].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ))}
      {DATES.map(({ key, label }) => (
        <label
          key={key}
          className="flex min-w-0 flex-1 basis-36 items-center gap-1.5 text-xs text-muted sm:flex-none"
        >
          <span className="shrink-0">{label}</span>
          <input
            type="date"
            value={filters[key]}
            max={key === "deadlineFrom" && filters.deadlineTo ? filters.deadlineTo : undefined}
            min={key === "deadlineTo" && filters.deadlineFrom ? filters.deadlineFrom : undefined}
            onChange={(e) => onChange({ ...filters, [key]: e.target.value })}
            aria-label={`Deadline ${label.toLowerCase()}`}
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
      ))}
      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="h-9 rounded-lg px-3 text-xs font-medium text-accent transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          Clear
        </button>
      )}
    </section>
  );
}
