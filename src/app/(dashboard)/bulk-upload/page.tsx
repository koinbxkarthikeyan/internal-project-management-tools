import { Suspense } from "react";
import BulkUploadPage from "@/features/bulk/components/BulkUploadPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Bulk Upload" };

export default function Page() {
  // The open tab is read from the URL (?type=owner), which needs a Suspense boundary.
  return (
    <Suspense>
      <BulkUploadPage />
    </Suspense>
  );
}
