"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * A choice kept in the URL (e.g. `?tab=everyone`), so a reload or a shared link opens the same one.
 * Anything not in `allowed` falls back to `fallback`. The fallback is not written to the URL.
 */
export function useQueryState<T extends string>(key: string, allowed: readonly T[], fallback: T): [T, (value: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const raw = params.get(key);
  const value = allowed.includes(raw as T) ? (raw as T) : fallback;

  const set = useCallback(
    (next: T) => {
      const search = new URLSearchParams(params.toString());
      if (next === fallback) search.delete(key);
      else search.set(key, next);
      const query = search.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [fallback, key, params, pathname, router],
  );

  return [value, set];
}
