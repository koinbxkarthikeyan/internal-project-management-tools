"use client";

import { useState, type FocusEvent, type ReactNode } from "react";
import Image from "next/image";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { SparkIcon } from "@/components/ui/icons";

type AuthShellProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

const isField = (el: EventTarget | null) => el instanceof Element && !!el.closest("input");

/**
 * Sign-in layout, laid out like the KoinBX admin sign-in: two big faded logo marks behind the page (a 720px one at the
 * top left, a 600px mirrored one at the bottom right, each brightest at 56% / 56% and fading out), then the logo, the
 * tagline and a 420px-wide card with a gradient border. Responsive from phones up.
 */
export default function AuthShell({ title, description, children }: AuthShellProps) {
  // The right-hand shape turns a little (10°) towards the card while the pointer is over the sign-in card or a text field
  // (email or password) has focus, including the email field that is focused when the page opens. It turns back once the
  // pointer has left and no field is focused. Moving between the two fields keeps focus inside the card, so it doesn't flicker.
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const turned = hover || focus;
  const focusIn = (e: FocusEvent) => isField(e.target) && setFocus(true);
  const focusOut = (e: FocusEvent) => !isField(e.relatedTarget) && setFocus(false);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-16 pt-16 sm:px-6 sm:pb-28 sm:pt-6 lg:px-8">
      {/* Background marks. Sizes and offsets follow the admin sign-in: 720px at -top-32 -left-30, 600px at -bottom-40 -right-25. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-bg-shape absolute left-[calc(var(--s)*-0.1667)] top-[calc(var(--s)*-0.1778)] size-(--s) [--s:clamp(260px,60vw,720px)] opacity-[0.55]">
          <Image src="/koinbx-mark.svg" alt="" fill priority sizes="(min-width: 1200px) 720px, 60vw" className="translate-x-[calc(var(--s)*-0.0667)] translate-y-[calc(var(--s)*-0.0333)] object-contain" />
        </div>
        <div className="auth-bg-shape absolute bottom-[calc(var(--s)*-0.2667)] right-[calc(var(--s)*-0.1667)] size-(--s) [--s:clamp(220px,50vw,600px)] opacity-[0.45]">
          <Image
            src="/koinbx-mark.svg"
            alt=""
            fill
            sizes="(min-width: 1200px) 600px, 50vw"
            className={`translate-x-[calc(var(--s)*0.0533)] translate-y-[calc(var(--s)*0.0267)] object-contain will-change-transform [transform:scaleX(-1)] transition-[rotate] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:rotate-0 motion-reduce:transition-none ${
              // Turn at once; on release wait a moment, so moving from one field to the other doesn't send it back and forth.
              turned ? "rotate-[10deg] delay-0" : "rotate-0 delay-150"
            }`}
          />
        </div>
      </div>
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <main className="anim-page-in relative z-10 w-full max-w-[420px]">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <Logo className="[&_img]:h-11" />
          </div>
          <p className="text-[15px] font-medium leading-relaxed text-muted">Sign in to access your backlog tracker</p>
          <div className="mb-6 mt-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
              <SparkIcon width={12} height={12} />
              Backlog tracker
            </span>
          </div>
        </div>
        <section className="auth-card rounded-[25px] p-[2px]" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={focusIn} onBlur={focusOut}>
          <div className="auth-card-body rounded-[23px] p-6 sm:p-8">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
            <div className="mt-6">{children}</div>
          </div>
        </section>
        <p className="mt-4 text-center text-[11px] font-medium tracking-wide text-muted">© {new Date().getFullYear()} KoinBX · All rights reserved</p>
      </main>
    </div>
  );
}
