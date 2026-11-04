import { useEffect, useState } from "react";

/** Where a panel opened over another form sits: in the middle of that form (`top` is its vertical middle: the panel is lifted by half its own height), no taller than the form (less a margin). */
export type NestedDock = { left: number; top: number; height: number };
export const NESTED_WIDTH = 448; // 28rem

type Found = { parent: Element; dock: NestedDock } | null;

/** The form (open dialog) this panel is being opened over, and the place for the panel in the middle of it; `null` when there is no such form or it is too narrow for a side panel (a small screen): the panel is then centred over it. */
function findParent(): Found {
  if (typeof document === "undefined") return null;
  const parent = [...document.querySelectorAll("dialog[open]")].pop();
  if (!parent) return null;
  const r = parent.getBoundingClientRect();
  const margin = 12;
  if (r.width < NESTED_WIDTH + 2 * margin + 120) return { parent, dock: null as unknown as NestedDock };
  return { parent, dock: { left: r.left + (r.width - NESTED_WIDTH) / 2, top: r.top + r.height / 2, height: r.height - 2 * margin } };
}

/** Blurs and dims one form; returns what puts it back. */
function blurForm(el: HTMLElement): () => void {
  const before = { filter: el.style.filter, transition: el.style.transition };
  el.style.transition = "filter 200ms ease";
  el.style.filter = "blur(3px) brightness(0.92)";
  return () => {
    el.style.filter = before.filter;
    el.style.transition = before.transition;
  };
}

/**
 * For a panel opened over a form: its place inside that form, and, while it is open, the form (and only the form) is blurred and dimmed so the panel stands out. The page
 * behind keeps the form's own backdrop; nothing else is blurred.
 */
export function useNestedDock(enabled = true): NestedDock | null {
  const [found] = useState<Found>(() => (enabled ? findParent() : null));
  useEffect(() => {
    if (!found) return;
    return blurForm(found.parent as HTMLElement);
  }, [found]);
  return found?.dock ?? null;
}

/** Where a small form sits when it opens next to the button that opened it: the button's rectangle; the form is then put below it, or above it, or lifted until it is whole on the screen (see `placeNear`). */
export type NearButton = { left: number; buttonTop: number; buttonBottom: number };

function nearButton(): NearButton | null {
  if (typeof document === "undefined" || window.innerWidth < 640) return null;
  const el = document.activeElement;
  // Only a real button / link that is on the screen counts; anything else (a menu that has just closed, the page) leaves the form centred.
  if (!(el instanceof HTMLElement) || el === document.body || !el.closest("button, a, [role=button], [role=menuitem]")) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > window.innerHeight) return null;
  const W = Math.min(NESTED_WIDTH, window.innerWidth - 32);
  const margin = 16;
  return { left: Math.max(margin, Math.min(r.left, window.innerWidth - W - margin)), buttonTop: r.top, buttonBottom: r.bottom };
}

/** For a small form that is not opened over another form: the button it opened from (`null` = centred). */
export function useNearButton(enabled: boolean): NearButton | null {
  const [pos] = useState<NearButton | null>(() => (enabled ? nearButton() : null));
  return pos;
}

/** The top of a form `height` tall opened from a button: just below it when the whole form fits there, else just above it when it fits there, else as low on the screen as it can go while staying whole (and no higher than the top margin). */
export function placeNear(near: NearButton, height: number): number {
  const margin = 16;
  const gap = 8;
  const room = window.innerHeight - margin;
  if (near.buttonBottom + gap + height <= room) return near.buttonBottom + gap;
  if (near.buttonTop - gap - height >= margin) return near.buttonTop - gap - height;
  return Math.max(margin, room - height);
}

/** The horizontal middle of the page's content area (the part right of the sidebar), where a small form is centred; `null` on a screen where the sidebar is not beside the content (then the form is centred on the screen). */
function contentCentre(): number | null {
  // Small forms open in the middle of the right half of the window.
  if (typeof document === "undefined" || window.innerWidth < 1024) return null;
  return window.innerWidth * 0.75;
}

export function useContentCentre(enabled: boolean): number | null {
  const [cx] = useState<number | null>(() => (enabled ? contentCentre() : null));
  return cx;
}
