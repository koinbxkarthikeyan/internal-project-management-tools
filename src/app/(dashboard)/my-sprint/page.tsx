import { Suspense } from "react";
import WorkPage from "@/features/work/components/WorkPage";

export default function Page() {
  // The page reads its tab from the URL (?tab=everyone), which needs a Suspense boundary.
  return (
    <Suspense>
      <WorkPage />
    </Suspense>
  );
}
