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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-12 lg:px-8">
      {/* Background marks. Sizes and offsets follow the admin sign-in: 720px at -top-32 -left-30, 600px at -bottom-40 -right-25. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-glow absolute left-1/2 top-1/2 size-[min(90vw,760px)] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <div className="auth-bg-shape auth-drift absolute left-[calc(var(--s)*-0.1667)] top-[calc(var(--s)*-0.1778)] size-(--s) [--s:clamp(260px,60vw,720px)] opacity-[0.55]">
          <Image src="/koinbx-mark.svg" alt="" fill priority sizes="(min-width: 1200px) 720px, 60vw" className="translate-x-[calc(var(--s)*-0.0667)] translate-y-[calc(var(--s)*-0.0333)] object-contain" />
        </div>
        <div className="auth-bg-shape auth-drift auth-drift-alt absolute bottom-[calc(var(--s)*-0.2667)] right-[calc(var(--s)*-0.1667)] size-(--s) [--s:clamp(220px,50vw,600px)] opacity-[0.45]">
          <Image
            src="/koinbx-mark.svg"
            alt=""
            fill
            sizes="(min-width: 1200px) 600px, 50vw"
            className={`translate-x-[calc(var(--s)*0.0533)] translate-y-[calc(var(--s)*0.0267)] object-contain will-change-transform [transform:scaleX(-1)] transition-[rotate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:rotate-0 motion-reduce:transition-none ${
              // Turn at once; on release wait a moment, so moving from one field to the other doesn't send it back and forth.
              turned ? "rotate-[10deg] delay-0" : "rotate-0 delay-150"
            }`}
          />
        </div>
      </div>
      <div className="absolute right-4 top-4 z-10 rounded-xl bg-surface/70 shadow-sm backdrop-blur-sm">
        <ThemeToggle />
      </div>
      <main className="anim-page-in relative z-10 w-full max-w-[420px]">
        <div className="text-center">
          <div className="anim-fade-up mb-6 flex justify-center">
            <Logo className="[&_img]:h-12" />
          </div>
          <p className="anim-fade-up text-[15px] font-medium leading-relaxed text-muted [animation-delay:60ms]">Sign in to access your backlog tracker</p>
          <div className="anim-fade-up mb-7 mt-3 flex justify-center [animation-delay:120ms]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1 shadow-sm backdrop-blur-sm text-[11px] font-semibold uppercase tracking-wide text-accent">
              <SparkIcon width={12} height={12} />
              Backlog tracker
            </span>
          </div>
        </div>
        <section className="auth-card anim-fade-up rounded-[25px] p-[2px] [animation-delay:180ms]" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={focusIn} onBlur={focusOut}>
          <div className="auth-card-body rounded-[23px] p-6 sm:p-8">
            <h1 className="auth-title text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
            {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
            <div key={title} className="anim-step-in mt-6">{children}</div>
          </div>
        </section>
        <p className="mt-5 text-center text-[11px] font-medium tracking-wide text-muted">© {new Date().getFullYear()} KoinBX · All rights reserved</p>
      </main>
    </div>
  );
}
