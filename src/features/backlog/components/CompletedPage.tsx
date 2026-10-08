"use client";

import PageHeader from "@/components/layout/PageHeader";
import { useBacklog } from "../context/BacklogContext";
import BacklogList from "./BacklogList";

export default function CompletedPage() {
  const { items } = useBacklog();
  const completed = items.filter((i) => i.status === "Completed");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Completed" description="Items that have been delivered." />
      <BacklogList items={completed} total={completed.length} emptyTitle="No completed items yet" emptyMessage="Items marked as Completed will show up here." />
    </div>
  );
}
