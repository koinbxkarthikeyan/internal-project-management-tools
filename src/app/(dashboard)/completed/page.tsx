import CompletedPage from "@/features/backlog/components/CompletedPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Done" };

export default function Page() {
  return <CompletedPage />;
}
