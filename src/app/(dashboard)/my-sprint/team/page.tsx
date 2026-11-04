import { Suspense } from "react";
import TeamWorkPage from "@/features/work/components/TeamWorkPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Team Work Details" };

export default function Page() {
  // The breakdown (By person / By POD / Across the sprint) is kept in the URL, which needs a Suspense boundary.
  return (
    <Suspense>
      <TeamWorkPage />
    </Suspense>
  );
}
