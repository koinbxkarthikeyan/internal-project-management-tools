"use client";

import type { ReactNode } from "react";
import PageSkeleton from "@/components/layout/PageSkeleton";
import { useBacklog } from "../context/BacklogContext";

/** Shows a skeleton while the API data loads, and a retry card if it fails. */
export default function BacklogDataGate({ children }: { children: ReactNode }) {
  const { status, error, reload } = useBacklog();

  if (status === "loading") return <PageSkeleton />;

  if (status === "error") {
    return (
      <section
        role="alert"
        className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-border bg-surface p-8 text-center"
      >
        <h2 className="text-base font-semibold">Couldn&apos;t load your backlog</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try again
        </button>
      </section>
    );
  }

  return <>{children}</>;
}
