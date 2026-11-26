"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)";
const subscribe = (notify: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", notify);
  return () => mq.removeEventListener("change", notify);
};

/** True on a phone-sized screen (under 768px); follows the window as it is resized or rotated. Always false while the page is first drawn on the server. */
export function useIsPhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
