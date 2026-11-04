import MyTaskPage from "@/features/work/components/MyTaskPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "My Task" };

export default function Page() {
  return <MyTaskPage />;
}
