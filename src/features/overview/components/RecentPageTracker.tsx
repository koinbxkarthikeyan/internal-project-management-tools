"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { usePagesStore } from "@/stores/pagesStore";
import { pagesFor } from "../pageList";

/** Lives in the app shell and records each page the person opens (only pages of the sidebar list), for the Recent chips on Overview. It renders nothing. */
export default function RecentPageTracker() {
  const pathname = usePathname();
  const { user, restricted, isAdmin } = useAuth();
  const signedIn = !!user;

  useEffect(() => usePagesStore.getState().load(), []);
  useEffect(() => {
    if (signedIn && pagesFor({ restricted, isAdmin }).some((p) => p.href === pathname)) usePagesStore.getState().visit(pathname);
  }, [pathname, signedIn, restricted, isAdmin]);
  return null;
}
