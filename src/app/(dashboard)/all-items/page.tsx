import BacklogPage from "@/features/backlog/components/BacklogPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "All items" };

export default function AllItemsPage() {
  return <BacklogPage />;
}
