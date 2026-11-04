import { Suspense } from "react";
import WorkLoggedPage from "@/features/work/components/WorkLoggedPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Your Logged Work" };

export default function Page() {
  // The tab (My entries / My PODs & tasks) is kept in the URL, which needs a Suspense boundary.
  return (
    <Suspense>
      <WorkLoggedPage />
    </Suspense>
  );
}
