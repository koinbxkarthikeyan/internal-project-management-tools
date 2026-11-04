import { Suspense } from "react";
import QaTicketPage from "@/features/backlog/components/QaTicketPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Ticket · My Task" };

export default function Page() {
  return (
    <Suspense>
      <QaTicketPage />
    </Suspense>
  );
}
