"use client";

import { useEffect } from "react";
import { useSidebarStore } from "@/stores/sidebarStore";

/** While `open` (a card or row is showing its details) the sidebar is collapsed to give the page the width; see sidebarStore for when it is put back. */
export function useCollapseSidebar(open: boolean) {
  const hold = useSidebarStore((s) => s.hold);
  const release = useSidebarStore((s) => s.release);
  useEffect(() => {
    if (!open) return;
    hold();
    return release;
  }, [open, hold, release]);
}
