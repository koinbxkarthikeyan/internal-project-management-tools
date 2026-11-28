"use client";

import { useEffect } from "react";

const HOLD_MS = 350; // how long a finger rests on a card before it lifts
const SLOP = 8; // how far the finger may wander during that wait (a bigger move is a scroll)
const EDGE = 64; // near the top or bottom of the window (or of a scrolling box) the page scrolls

/** The nearest box around `el` that can scroll up and down, or the window. */
function scroller(el: Element | null): Element | null {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const { overflowY } = getComputedStyle(n);
    if ((overflowY === "auto" || overflowY === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

/**
 * Drag and drop with a finger. A phone or tablet does not send the browser's drag events for a touch, so every list, board and rail that uses them (the `draggable` rows
 * and cards with their dragover / drop handlers) would not move. This listens once for the whole app: rest a finger on a draggable card for a moment and it lifts
 * (a copy follows the finger), move it over a drop area, lift the finger to drop. It sends the same events a mouse drag does, so nothing else needs to know about touch.
 * A quick swipe still scrolls the page, and a mouse is not touched by any of this.
 */
export default function TouchDrag() {
  useEffect(() => {
    let source: HTMLElement | null = null;
    let timer = 0;
    let start = { x: 0, y: 0 };
    let at = { x: 0, y: 0 };
    let lifted = false;
    let ghost: HTMLElement | null = null;
    let over: Element | null = null;
    let accepts = false;
    let data: DataTransfer | null = null;
    let scrollTimer = 0;

    const fire = (type: string, el: Element, related?: Element | null) => {
      const e = new DragEvent(type, { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y, dataTransfer: data, relatedTarget: related ?? null });
      el.dispatchEvent(e);
      return e;
    };

    const stopScrolling = () => (window.clearInterval(scrollTimer), (scrollTimer = 0));
    const finish = (drop: boolean) => {
      window.clearTimeout(timer);
      stopScrolling();
      if (lifted && source) {
        if (drop && over && accepts) fire("drop", over);
        else if (over) fire("dragleave", over);
        fire("dragend", source);
      }
      ghost?.remove();
      document.documentElement.classList.remove("touch-dragging");
      source = ghost = over = data = null;
      lifted = accepts = false;
    };

    const lift = () => {
      if (!source) return;
      lifted = true;
      data = new DataTransfer();
      const box = source.getBoundingClientRect();
      ghost = source.cloneNode(true) as HTMLElement;
      Object.assign(ghost.style, { position: "fixed", left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, margin: "0", zIndex: "9999", pointerEvents: "none", opacity: ".85", transform: "scale(1.02)", boxShadow: "0 12px 28px rgba(0,0,0,.35)", transition: "none" });
      ghost.removeAttribute("id");
      ghost.dataset.ghost = "";
      ghost.dataset.dx = String(at.x - box.left);
      ghost.dataset.dy = String(at.y - box.top);
      document.body.appendChild(ghost);
      document.documentElement.classList.add("touch-dragging");
      navigator.vibrate?.(12);
      fire("dragstart", source);
    };

    const moveGhost = () => {
      if (!ghost) return;
      ghost.style.left = `${at.x - Number(ghost.dataset.dx)}px`;
      ghost.style.top = `${at.y - Number(ghost.dataset.dy)}px`;
    };

    const target = () => {
      const el = document.elementFromPoint(at.x, at.y);
      if (el !== over) {
        if (over) fire("dragleave", over, el);
        over = el;
        if (el) fire("dragenter", el, null);
      }
      // A drop area says it takes the card by cancelling dragover.
      accepts = !!el && fire("dragover", el).defaultPrevented;
    };

    const autoScroll = () => {
      const box = scroller(over);
      const rect = box ? box.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const step = at.y < rect.top + EDGE ? -14 : at.y > rect.bottom - EDGE ? 14 : 0;
      if (!step) return;
      if (box) box.scrollTop += step;
      else window.scrollBy(0, step);
      target();
    };

    const onStart = (e: TouchEvent) => {
      finish(false);
      if (e.touches.length !== 1) return;
      const card = (e.target as Element).closest<HTMLElement>('[draggable="true"]');
      if (!card) return;
      const t = e.touches[0];
      source = card;
      start = at = { x: t.clientX, y: t.clientY };
      timer = window.setTimeout(() => {
        lift();
        scrollTimer = window.setInterval(autoScroll, 40);
      }, HOLD_MS);
    };
    const onMove = (e: TouchEvent) => {
      if (!source) return;
      const t = e.touches[0];
      at = { x: t.clientX, y: t.clientY };
      if (!lifted) {
        // Moved before the card lifted: the person is scrolling.
        if (Math.hypot(at.x - start.x, at.y - start.y) > SLOP) finish(false);
        return;
      }
      e.preventDefault(); // the page must not scroll under a card being carried
      moveGhost();
      target();
    };
    const onEnd = (e: TouchEvent) => {
      if (lifted) e.preventDefault(); // no click after a drag
      finish(true);
    };
    const onCancel = () => finish(false);
    const onMenu = (e: Event) => (source || lifted) && e.preventDefault(); // a long press must not open the browser's menu

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: false });
    document.addEventListener("touchcancel", onCancel);
    document.addEventListener("contextmenu", onMenu);
    return () => {
      finish(false);
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
      document.removeEventListener("contextmenu", onMenu);
    };
  }, []);
  return null;
}
