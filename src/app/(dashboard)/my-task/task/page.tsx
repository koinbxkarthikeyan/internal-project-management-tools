import { Suspense } from "react";
import QaTaskPage from "@/features/backlog/components/QaTaskPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Task · My Task" };

export default function Page() {
  // Which task is open is kept in the address (?id=), which needs a Suspense boundary.
  return (
    <Suspense>
      <QaTaskPage />
    </Suspense>
  );
}
