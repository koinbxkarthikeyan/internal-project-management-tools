"use client";

export default function AllItemsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">Something went wrong loading items.</h2>
      <button
        onClick={() => retry()}
        className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-hover"
      >
        Try again
      </button>
    </div>
  );
}
