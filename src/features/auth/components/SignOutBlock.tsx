"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import RailTip from "@/components/ui/RailTip";
import { ChevronRightIcon, LogoutIcon, SettingsIcon } from "@/components/ui/icons";
import { LOGIN_PATH } from "@/constants/auth";
import { signOut } from "@/lib/auth/authService";
import Avatar from "@/features/messages/components/Avatar";
import { useAuth } from "../hooks/useAuth";
import ThemeRow from "./ThemeRow";

/** Marks the card, the menu and the Theme flyout, so a click on any of them is "inside" the account menu. */
const PART = "data-account-part";

/**
 * The account card at the bottom of the sidebar (avatar, name, a round chevron) and the menu it opens above itself: name and email, Theme, Settings, Sign Out.
 * In the collapsed sidebar the card shrinks to the avatar. Esc, a click outside, or clicking the card again closes the menu. While it is open the sidebar's menu area is
 * lightly blurred and dimmed (the `data-account-menu` flag on <html>, not to be confused with the parts marker below, see globals.css); the logo, header buttons, card, menu and page stay sharp.
 * The menu is drawn in a portal so neither the narrow rail nor the drawer clips it.
 */
export default function SignOutBlock() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const card = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null);
  const open = at !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setAt(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => !(e.target as Element).closest(`[${PART}]`) && close();
    document.documentElement.dataset.accountMenu = "open";
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", close);
    return () => {
      delete document.documentElement.dataset.accountMenu;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!user) return null;

  const toggle = () => {
    const r = card.current?.getBoundingClientRect();
    setAt(open || !r ? null : { left: r.left, bottom: window.innerHeight - r.top + 8 });
  };
  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <div className="border-t border-border pt-2">
      <RailTip label={user.name}>
        <button
          ref={card}
          type="button"
          {...{ [PART]: "" }}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          onClick={toggle}
          className="sb-item flex w-full items-center gap-3 card-inset px-3 py-2 text-left transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Avatar name={user.name} size={32} />
          <span className="sb-label min-w-0 flex-1 truncate text-sm font-medium">{user.name}</span>
          <span className="sb-label grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted">
            <ChevronRightIcon width={14} height={14} className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-90" : "-rotate-90"}`} />
          </span>
        </button>
      </RailTip>
      {at &&
        createPortal(
          <div
            {...{ [PART]: "" }}
            role="menu"
            aria-label="Account"
            style={{ left: at.left, bottom: at.bottom }}
            className="fixed z-[60] w-60 rounded-xl border border-border bg-surface p-1.5 shadow-lg"
          >
            <div className="border-b border-border px-3 pb-2 pt-1.5">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <div className="mt-1.5 flex flex-col gap-0.5">
              <ThemeRow />
              <Link
                href="/settings"
                role="menuitem"
                aria-current={pathname === "/settings" ? "page" : undefined}
                onClick={() => setAt(null)}
                className={`${item} ${pathname === "/settings" ? "bg-accent-soft font-medium text-accent" : "text-muted"}`}
              >
                <SettingsIcon className="shrink-0" />
                Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAt(null);
                  signOut();
                  router.replace(LOGIN_PATH);
                }}
                className={`${item} text-muted`}
              >
                <LogoutIcon className="shrink-0" />
                Sign Out
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
