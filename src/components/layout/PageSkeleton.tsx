"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Placeholder shown while a page's data loads. Each page gets a placeholder with its own layout (header, summary cards,
 * tabs, table or card sections), built from the same few pieces and the same surface, border and pulse colours as the page
 * itself, so it works in both themes. It fades in after a short delay, so a quick load never flashes it.
 */

const bar = "rounded-md bg-hover";

function Header({ action }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-72">
        <div className="h-8 w-48 rounded-lg bg-hover" />
        <div className={`${bar} mt-2 h-4 w-full max-w-md`} />
      </div>
      {action && <div className="h-10 w-36 rounded-xl bg-hover" />}
    </div>
  );
}

function Stats() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-4">
          <div className={`${bar} h-3 w-16`} />
          <div className={`${bar} mt-3 h-7 w-10`} />
        </div>
      ))}
    </div>
  );
}

function Tabs({ count = 2 }: { count?: number }) {
  return (
    <div className="flex w-fit max-w-full gap-1 rounded-xl border border-border bg-surface p-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-8 w-32 rounded-lg bg-hover" />
      ))}
    </div>
  );
}

/** A bordered card of rows: `cols` cells per row (the first one wide), like the list and table rows. */
function Rows({ rows = 6, cols = 3, head = false }: { rows?: number; cols?: number; head?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      {head && <div className="h-10 border-b border-border bg-background/60" />}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-4">
            <div className={`${bar} h-4 flex-1`} />
            {Array.from({ length: cols - 1 }, (_, c) => (
              <div key={c} className="h-5 w-16 rounded-full bg-hover sm:w-20" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Filters() {
  return <div className="h-16 rounded-2xl border border-border bg-surface" />;
}

function Card({ lines = 4, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>
      <div className={`${bar} h-4 w-28`} />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`${bar} h-3 w-20 shrink-0`} />
            <div className="h-2 flex-1 rounded-full bg-hover" style={{ maxWidth: `${90 - i * 14}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SprintSection() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className={`${bar} h-4 w-56`} />
        <div className="h-5 w-16 rounded-full bg-hover" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className={`${bar} h-4 flex-1`} />
            <div className="h-5 w-16 rounded-full bg-hover" />
            <div className="h-5 w-20 rounded-full bg-hover" />
          </div>
        ))}
      </div>
    </div>
  );
}

const layouts: Record<string, ReactNode> = {
  "/overview": (
    <>
      <Header />
      <Stats />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card lines={5} />
        <Card lines={4} />
      </div>
      <Rows rows={4} cols={2} />
    </>
  ),
  "/all-items": (
    <>
      <Header action />
      <Stats />
      <Filters />
      <Rows />
    </>
  ),
  "/completed": (
    <>
      <Header />
      <Rows />
    </>
  ),
  "/sprint-plan": (
    <>
      <Header action />
      <Tabs />
      <SprintSection />
      <SprintSection />
    </>
  ),
  "/owners-sprints": (
    <>
      <Header action />
      <Rows head cols={5} />
    </>
  ),
  "/users": (
    <>
      <Header action />
      <Rows head cols={4} />
    </>
  ),
  "/my-task": (
    <>
      <Header />
      <Tabs />
      <Rows head cols={4} rows={5} />
    </>
  ),
  "/my-sprint": (
    <>
      <Header />
      <Tabs count={3} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card lines={5} />
        <Card lines={5} />
      </div>
    </>
  ),
  "/settings": (
    <>
      <Header />
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="h-14 w-14 shrink-0 rounded-full bg-hover" />
        <div className="flex-1">
          <div className={`${bar} h-5 w-40`} />
          <div className={`${bar} mt-2 h-4 w-56`} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card lines={3} />
        <Card lines={3} />
      </div>
    </>
  ),
};

/** Any other page (Dashboard, Projects): a header and one block. */
const fallback = (
  <>
    <Header />
    <Rows rows={4} cols={2} />
  </>
);

export default function PageSkeleton() {
  const pathname = usePathname();
  const key = Object.keys(layouts).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <div className="skeleton-delay">
      <div className="flex animate-pulse flex-col gap-6" role="status" aria-label="Loading">
        {key ? layouts[key] : fallback}
      </div>
    </div>
  );
}
