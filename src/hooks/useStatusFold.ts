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
 * The status columns of a board that fold into slim vertical bars. How many are open follows the width of the board (`ref`) all the time: as many as fit side by side at a readable
 * width (at least one; all of them when there is room). When the board gets tight (the window or a panel resizes) the surplus folds by itself and opens again when there is room. `openFirst` is the order in which
 * statuses open by default. With `hasItems`, a status with nothing in it is always folded and its bar can't be opened (unless every status is empty). Opening a bar never folds another, but once as many are open as the screen has room for (`capacity`) opening one folds the one that has been open longest; the last open status can't be folded away (the first of `openFirst`
 * opens instead).
 */
export function useStatusFold(ref: RefObject<HTMLElement | null>, titles: readonly string[], openFirst: readonly string[], hasItems?: (title: string) => boolean) {
  const count = titles.length;
  // How many fit side by side in the board's width right now (follows every resize, also when a panel or the sidebar takes or gives width).
  const [capacity, setCapacity] = useState(count);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCapacity(openThatFit(count, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, count]);
  const [picked, setPicked] = useState<string[] | null>(null);
  // A status with nothing in it stays folded and can't be opened (unless every status is empty, then none is held back).
  const anyItems = !hasItems || titles.some(hasItems);
  const empty = (title: string) => !!hasItems && anyItems && !hasItems(title);
  const ranked = titles.filter((t) => !empty(t)).sort((a, b) => Number(hasItems ? !hasItems(a) : 0) - Number(hasItems ? !hasItems(b) : 0) || openFirst.indexOf(a) - openFirst.indexOf(b));
  const room = Math.max(1, capacity);
  const wanted = (picked ?? ranked.slice(0, room)).filter((t) => !empty(t));
  // Tight board: more are open than fit, so the surplus folds by itself. The ones opened last stay; with no choice made, the first by rank stay. They open again when there is room.
  const shown = wanted.length > room ? wanted.slice(picked ? -room : 0, picked ? undefined : room) : wanted;
  const isFolded = (title: string) => !shown.includes(title);
  const toggle = (title: string) => {
    if (empty(title)) return;
    if (isFolded(title)) return setPicked([...shown.slice(Math.max(0, shown.length - room + 1)), title]);
    const rest = shown.filter((t) => t !== title);
    setPicked(rest.length ? rest : [openFirst.find((t) => titles.includes(t) && !empty(t)) ?? title]);
  };
  return { isFolded, toggle, isEmpty: empty };
}
