/** Pulsing placeholder shown while page data loads. */
export default function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" role="status" aria-label="Loading">
      <div className="h-8 w-48 rounded-lg bg-hover" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-hover" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-hover" />
    </div>
  );
}
