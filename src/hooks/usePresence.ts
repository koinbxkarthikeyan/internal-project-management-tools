"use client";

import { useEffect, useState } from "react";

/**
 * Lets a thing that appears and disappears (a panel, a menu) animate both ways. `mounted` is whether to keep it in the page: it is true as soon as `open` is, and stays true
 * for `ms` after `open` goes false, so the closing animation can play before it is removed. `shown` is the resting "open" look: it turns true one frame after mounting (so a
 * transition has a starting point to grow from) and false the moment `open` goes false.
 */
export function usePresence(open: boolean, ms = 200) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  const [was, setWas] = useState(open);
  // Adjusting state while rendering (the React-recommended way to react to a changed prop): mount at once on open, drop the open look at once on close.
  if (was !== open) {
    setWas(open);
    if (open) setMounted(true);
    else setShown(false);
  }
  useEffect(() => {
    if (open && mounted && !shown) {
      let second = 0;
      const first = requestAnimationFrame(() => (second = requestAnimationFrame(() => setShown(true))));
      return () => (cancelAnimationFrame(first), cancelAnimationFrame(second));
    }
    if (!open && mounted) {
      const timer = window.setTimeout(() => setMounted(false), ms);
      return () => window.clearTimeout(timer);
    }
  }, [open, mounted, shown, ms]);
  return { mounted, shown };
}

/**
 * For a dropdown list or menu that already animates in (`anim-menu-in`): keeps it mounted while it animates out (`anim-menu-out`), and not clickable meanwhile. Use `mounted` for
 * "is it in the page" and add `motion` to its classes.
 */
export function useMenuPresence(open: boolean) {
  const { mounted } = usePresence(open, 180);
  return { mounted, motion: open ? "anim-menu-in" : "anim-menu-out pointer-events-none" };
}
