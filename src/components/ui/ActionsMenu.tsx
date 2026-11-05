"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { DotsIcon } from "@/components/ui/icons";

export type MenuAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** Red styling; with `confirmLabel` the action needs a second click. */
  danger?: boolean;
  confirmLabel?: string;
};

type ActionsMenuProps = {
  /** Accessible name, e.g. "Actions for Fix login". */
  label: string;
  actions: MenuAction[];
};

type Position = { right: number; top?: number; bottom?: number };

const MENU_HEIGHT = 140; // upper bound (3 items)

const menuItem =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none";

/** Three-dot row menu. Rendered with fixed positioning so the table's overflow never clips it. */
export default function ActionsMenu({ label, actions }: ActionsMenuProps) {
  const [pos, setPos] = useState<Position | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  // Pinned = opened by click/keyboard; stays open until dismissed. Otherwise it is a hover preview.
  const [pinned, setPinned] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const focusOnOpen = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  const close = useCallback((restoreFocus = false) => {
    clearTimeout(leaveTimer.current);
    if (restoreFocus) triggerRef.current?.focus();
    // Play the fade-out, then unmount.
    setLeaving(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setPos(null);
      setConfirming(null);
      setPinned(false);
      setLeaving(false);
    }, 110);
  }, []);

  function openMenu() {
    if (leaving) {
      clearTimeout(closeTimer.current);
      setLeaving(false);
      return;
    }
    if (open) return;
    const r = triggerRef.current!.getBoundingClientRect();
    const right = window.innerWidth - r.right;
    setPos(
      r.bottom + MENU_HEIGHT > window.innerHeight
        ? { right, bottom: window.innerHeight - r.top }
        : { right, top: r.bottom },
    );
  }

  function handleClick() {
    clearTimeout(leaveTimer.current);
    if (!open) {
      focusOnOpen.current = true;
      setPinned(true);
      openMenu();
    } else if (!pinned) {
      setPinned(true);
    } else {
      close();
    }
  }

  function handlePointerEnter(e: ReactPointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return;
    clearTimeout(leaveTimer.current);
    openMenu();
  }

  function handlePointerLeave(e: ReactPointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse" || pinned) return;
    leaveTimer.current = setTimeout(() => close(), 150);
  }

  useEffect(() => {
    if (!open) return;
    if (focusOnOpen.current) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
      focusOnOpen.current = false;
    }

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && close(true);
    const dismiss = () => close();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open, close]);

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const focus = (n: number) => items[(n + items.length) % items.length]?.focus();
    const keys: Record<string, number> = {
      ArrowDown: i + 1,
      ArrowUp: i - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (e.key in keys) {
      e.preventDefault();
      focus(keys[e.key]);
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <span onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent aria-expanded:bg-border aria-expanded:text-foreground"
      >
        <DotsIcon />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          style={pos}
          className={`fixed z-20 w-44 rounded-xl border border-border bg-surface p-1 shadow-menu ${
            pos.bottom !== undefined ? "origin-bottom-right" : "origin-top-right"
          } ${leaving ? "anim-menu-out" : "anim-menu-in"}`}
        >
          {actions.map((action) => {
            const isConfirming = confirming === action.key;
            return (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                className={`${menuItem} ${action.danger ? "text-red-600 dark:text-red-300" : ""} ${
                  isConfirming ? "bg-red-100 dark:bg-red-500/15" : ""
                }`}
                onClick={() => {
                  if (action.confirmLabel && !isConfirming) return setConfirming(action.key);
                  close();
                  action.onSelect();
                }}
              >
                {action.icon} {isConfirming && action.confirmLabel ? action.confirmLabel : action.label}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
