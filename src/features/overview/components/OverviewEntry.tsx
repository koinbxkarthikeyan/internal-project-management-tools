"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import OverviewPage from "@/features/backlog/components/OverviewPage";
import { useQueryState } from "@/hooks/useQueryState";
import PersonalOverviewPage from "./PersonalOverviewPage";

const TABS = [
  { id: "all", label: "Team" },
  { id: "mine", label: "Personal" },
] as const;

/**
 * The Overview: a Super Admin and an enabled Admin get two tabs, the whole team's backlog (Team) and their own (Personal); everyone else has only their own.
 */
export default function OverviewEntry() {
  const { restricted } = useAuth();
  const [view, setView] = useQueryState<"all" | "mine">("view", ["all", "mine"], "all");
  if (restricted) return <PersonalOverviewPage />;
  const tabs = (
    <div role="group" aria-label="Overview view" className="inline-flex w-fit gap-0.5 rounded-lg border border-border bg-surface p-0.5">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={view === t.id}
          onClick={() => setView(t.id)}
          className={`rounded-md px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
            view === t.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-hover hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
  // The tabs sit in the page header, beside the "Overview" title.
  return view === "mine" ? <PersonalOverviewPage tabs={tabs} /> : <OverviewPage tabs={tabs} />;
}
