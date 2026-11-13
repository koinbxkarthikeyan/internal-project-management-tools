import FilterBar, { DateRangeFilter, FILTER_SELECT_CLASS } from "@/components/ui/FilterBar";
import { SearchableSelect } from "@/components/ui/FormControls";
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
  /** Status is chosen on the status cards above the list, so it is not repeated here. */
  options: {
    priority: readonly string[];
    owner: readonly string[];
    sprint: readonly (string | { value: string; label: string })[];
  };
};

const SELECTS = [
  { key: "priority", label: "Priority" },
  { key: "owner", label: "Owner" },
  { key: "sprint", label: "Sprint" },
] as const;

export default function BacklogFilters({ filters, onChange, options }: BacklogFiltersProps) {
  return (
    <FilterBar
      search={<BacklogSearch value={filters.query} onChange={(query) => onChange({ ...filters, query })} />}
      activeCount={Object.values(filters).filter(Boolean).length}
      onClear={() => onChange(EMPTY_FILTERS)}
    >
      {SELECTS.map(({ key, label }) => (
        <SearchableSelect
          key={key}
          ariaLabel={`Filter by ${label.toLowerCase()}`}
          value={filters[key]}
          onChange={(v) => onChange({ ...filters, [key]: v })}
          options={options[key]}
          placeholder={`${label}: All`}
          className={FILTER_SELECT_CLASS}
        />
      ))}
      <DateRangeFilter label="Expected ETA" from={filters.deadlineFrom} to={filters.deadlineTo} onChange={({ from, to }) => onChange({ ...filters, deadlineFrom: from, deadlineTo: to })} />
    </FilterBar>
  );
}
