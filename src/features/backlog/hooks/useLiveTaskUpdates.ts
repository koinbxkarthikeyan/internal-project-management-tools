"use client";

import { useEffect } from "react";
import { onExternalChange } from "@/lib/localApi";

/**
 * Another tab of this browser can change the same data (the browser tells this tab through the `storage` event). When it does, `refresh` reads
 * the tasks again so this tab shows them as they now are. Changes made in this tab are already on its screens.
 */
export function useLiveTaskUpdates(enabled: boolean, refresh: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onExternalChange(() => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 300); // a burst of writes is read once
    });
    return () => {
      clearTimeout(timer);
      off();
    };
    // `refresh` is read when it fires; the listener is only set up again when the data becomes ready or not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
