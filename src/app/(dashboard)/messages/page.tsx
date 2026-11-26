import MessagesPage from "@/features/messages/components/MessagesPage";

import type { Metadata } from "next";
import { MESSAGES_LABEL } from "@/constants/work";
export const metadata: Metadata = { title: MESSAGES_LABEL };

export default function Page() {
  return <MessagesPage />;
}
