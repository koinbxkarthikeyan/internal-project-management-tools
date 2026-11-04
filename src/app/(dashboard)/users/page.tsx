import UsersPage from "@/features/users/components/UsersPage";

import type { Metadata } from "next";
export const metadata: Metadata = { title: "Team Members" };

export default function Page() {
  return <UsersPage />;
}
