"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WORK_HREF } from "@/constants/work";
import type { WorkEntry } from "@/types/work";

/** Your Logged Work opens an entry for changing as `/my-sprint?edit=<id>`: this starts that change once, then takes the id out of the address. */
export default function StartEditFromUrl({ entries, onEntry }: { entries: readonly WorkEntry[]; onEntry: (entry: WorkEntry) => void }) {
  const router = useRouter();
  const id = useSearchParams().get("edit");
  useEffect(() => {
    if (!id) return;
    const entry = entries.find((e) => e.id === id);
    if (entry) onEntry(entry);
    router.replace(WORK_HREF, { scroll: false });
    // Only the address decides when this runs: the entry is read once, when it appears in the address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return null;
}
