type BacklogSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function BacklogSearch({ value, onChange }: BacklogSearchProps) {
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
        placeholder="Search title or owner…"
        aria-label="Search backlog items"
        className="h-10 w-full field pl-8 pr-3 text-sm placeholder:text-muted"
      />
    </div>
  );
}
