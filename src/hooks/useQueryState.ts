"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { readPref, writePref } from "@/lib/preference";

/**
 * A choice kept in the URL (e.g. `?tab=everyone`), so a reload or a shared link opens the same one.
 * Anything not in `allowed` falls back to `fallback`. The fallback is not written to the URL.
 * With `remember` (a name), the choice is also kept in this browser: when the URL carries none (after opening another page, a task or a Ticket and coming back) the last choice is used.
 */
export function useQueryState<T extends string>(key: string, allowed: readonly T[], fallback: T, remember?: string): [T, (value: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const raw = params.get(key);
  const stored = remember && raw === null ? readPref(remember) : null;
  const value = allowed.includes(raw as T) ? (raw as T) : allowed.includes(stored as T) ? (stored as T) : fallback;

  const set = useCallback(
    (next: T) => {
      if (remember) writePref(remember, next);
      const search = new URLSearchParams(params.toString());
      if (next === fallback && !remember) search.delete(key);
      else search.set(key, next);
      const query = search.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [fallback, key, params, pathname, remember, router],
  );

  return [value, set];
}
