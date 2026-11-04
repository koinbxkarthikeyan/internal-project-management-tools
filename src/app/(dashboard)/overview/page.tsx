import { Suspense } from "react";
import OverviewEntry from "@/features/overview/components/OverviewEntry";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  // The tab (Overview / My Overview) is kept in the URL, which needs a Suspense boundary.
  return (
    <Suspense>
      <OverviewEntry />
    </Suspense>
  );
}
