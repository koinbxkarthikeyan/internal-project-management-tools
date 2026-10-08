export default function AllItemsLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading items">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-hover" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-hover" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-2xl bg-hover" />
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-4 px-4 py-4">
            <div className="h-4 flex-1 rounded bg-hover" />
            <div className="h-5 w-16 rounded-full bg-hover" />
            <div className="h-5 w-20 rounded-full bg-hover" />
          </div>
        ))}
      </div>
    </div>
  );
}
