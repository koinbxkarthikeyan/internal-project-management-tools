"use client";

import { useEffect, useState, type RefObject } from "react";

const COLUMN_MIN_PX = 240;
const RAIL_PX = 44;

/** How many of `count` columns can be open side by side in `width` px, leaving room for the one line of slim bars of the folded ones. At least one. */
function openThatFit(count: number, width: number) {
  for (let open = count; open > 1; open--) {
    const rails = count - open;
    if (open * COLUMN_MIN_PX + (open - 1) * 12 + (rails ? rails * RAIL_PX + (rails - 1) * 8 + 12 : 0) <= width) return open;
  }
  return 1;
}

/**
 * The status columns of a board that fold into slim vertical bars. How many are open is worked out from the width of the board (`ref`) when it appears: as many as fit side by side at a readable
 * width (at least one; all of them when there is room). It is not worked out again when the window or a panel resizes, so nothing folds by itself later. `openFirst` is the order in which
 * statuses open by default; with `hasItems` the ones that have something come first. Opening a bar never folds another; the last open status can't be folded away (the first of `openFirst`
 * opens instead).
 */
export function useStatusFold(ref: RefObject<HTMLElement | null>, titles: readonly string[], openFirst: readonly string[], hasItems?: (title: string) => boolean) {
  const [fit, setFit] = useState(titles.length);
  const count = titles.length;
  useEffect(() => {
    const el = ref.current;
    if (el) setFit(openThatFit(count, el.clientWidth));
  }, [ref, count]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const ranked = [...titles].sort((a, b) => Number(hasItems ? !hasItems(a) : 0) - Number(hasItems ? !hasItems(b) : 0) || openFirst.indexOf(a) - openFirst.indexOf(b));
  const open = picked ?? titles.filter((t) => ranked.indexOf(t) < fit);
  const isFolded = (title: string) => !open.includes(title);
  const toggle = (title: string) => {
    if (isFolded(title)) return setPicked([...open, title]);
    const rest = open.filter((t) => t !== title);
    setPicked(rest.length ? rest : [openFirst.find((t) => titles.includes(t)) ?? title]);
  };
  return { isFolded, toggle };
}
