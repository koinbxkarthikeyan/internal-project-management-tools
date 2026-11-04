"use client";

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { BacklogItemData } from "@/types/backlog";
import { useBacklog } from "../context/BacklogContext";
import BacklogList from "./BacklogList";
import ReopenDialog, { canReopenItem } from "./ReopenDialog";

export default function CompletedPage() {
  const { items, reload } = useBacklog();
  const { user, isAdmin, isQa } = useAuth();
  const [reopening, setReopening] = useState<BacklogItemData | null>(null);
  const completed = items.filter((i) => i.status === "Done");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Done" description="Items that are done. Reopen one to put it back where it was before it was completed." />
      <BacklogList
        items={completed}
        total={completed.length}
        emptyTitle="No done items yet"
        emptyMessage="Items marked as Done will show up here."
        rowAction={(item) =>
          canReopenItem(item, undefined, user, isAdmin, isQa) ? (
            <button type="button" onClick={() => setReopening(item)} className="h-8 rounded-lg border border-border px-3 text-xs font-semibold text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
              Reopen
            </button>
          ) : null
        }
      />
      {reopening && <ReopenDialog item={reopening} onClose={() => setReopening(null)} onReopened={() => reload()} />}
    </div>
  );
}
