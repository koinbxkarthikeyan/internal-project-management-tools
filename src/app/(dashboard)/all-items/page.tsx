import BacklogPage from "@/features/backlog/components/BacklogPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Backlog items" };

export default function AllItemsPage() {
  return <BacklogPage />;
}
