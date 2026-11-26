"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MY_TASK_HREF } from "@/constants/work";
import { useAuth } from "@/features/auth/hooks/useAuth";

// The badges on the right: x, y (in a 1400 x 120 box), radius, colour, and a 24-unit line icon for what this app is about (tasks, sprints, hours, people, backlog). The big one in the middle is the focus.
const ICONS = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  calendar: "M4 7h16v13H4zM4 11h16M8 4v4M16 4v4",
  clock: "M12 7v5l3 2M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0",
  users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 2.5-5 6-5s6 2 6 5M17 6a2.5 2.5 0 0 1 0 5M18 14c2 .5 3 2 3 4",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  flag: "M5 21V4M5 5h12l-2 4 2 4H5",
  bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
};
const COINS: { x: number; y: number; r: number; fill: string; icon: keyof typeof ICONS }[] = [
  { x: 60, y: 78, r: 11, fill: "#6b7280", icon: "flag" },
  { x: 190, y: 34, r: 14, fill: "#2dd4bf", icon: "list" },
  { x: 330, y: 74, r: 12, fill: "#a78bfa", icon: "users" },
  { x: 470, y: 36, r: 16, fill: "#38bdf8", icon: "clock" },
  { x: 640, y: 66, r: 20, fill: "#6366f1", icon: "calendar" },
  { x: 850, y: 52, r: 32, fill: "#f59e0b", icon: "check" },
  { x: 1040, y: 70, r: 22, fill: "#10b981", icon: "clock" },
  { x: 1170, y: 34, r: 14, fill: "#eab308", icon: "bolt" },
  { x: 1260, y: 82, r: 13, fill: "#f472b6", icon: "list" },
  { x: 1350, y: 44, r: 11, fill: "#a3a33a", icon: "users" },
];
// The small blue dots; each is joined by a dotted line to the badge nearest to it.
const NODES: [number, number][] = [
  [120, 104],
  [260, 14],
  [400, 104],
  [560, 12],
  [740, 106],
  [930, 14],
  [1100, 108],
  [1215, 106],
  [1300, 14],
];

/**
 * The top of the Overview and Settings pages: "Good Morning / Afternoon / Evening, <first name>" (the name in a blue-violet gradient), a line under it,
 * a link to My Task, and on a wide screen a row of connected badges. `children` (the Team / Personal tabs on Overview) sit under the banner on the right.
 */
export default function GreetingBanner({ description, workLink = true, children }: { description?: string; /** Show the "What are you working on today?" link (Overview has it; Settings does not). */ workLink?: boolean; children?: ReactNode }) {
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const first = user?.name.trim().split(/\s+/)[0] ?? "";
  return (
    <header className="flex flex-col gap-3">
      <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-surface via-surface to-accent-soft/40 px-5 py-4">
        <div className="relative z-10 min-w-0">
          {/* The greeting depends on the time of day, so it can differ between the server's render and the browser's. */}
          <h1 suppressHydrationWarning className="text-xl font-semibold tracking-tight sm:text-2xl">
            {greeting}
            {first && (
              <>
                ,{" "}
                <span className="greeting-name">{first}</span>
              </>
            )}
          </h1>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {workLink && (
          <Link
            href={MY_TASK_HREF}
            className="relative z-10 ml-auto hidden shrink-0 items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 text-sm text-muted backdrop-blur-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent md:inline-flex"
          >
            What are you working on today?
            <span aria-hidden="true" className="text-accent">
              →
            </span>
          </Link>
        )}
        <svg viewBox="0 0 1400 120" aria-hidden="true" preserveAspectRatio="xMidYMid slice" className="pointer-events-none -my-4 -mr-5 hidden min-w-0 flex-1 self-stretch lg:block">
          <g stroke="#94a3b8" strokeOpacity=".35" strokeDasharray="3 4" fill="none">
            <polyline points={COINS.map((c) => `${c.x},${c.y}`).join(" ")} />
            {NODES.map(([x, y]) => {
              const c = COINS.reduce((a, b) => (Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b));
              return <line key={`${x}-${y}`} x1={x} y1={y} x2={c.x} y2={c.y} />;
            })}
          </g>
          {NODES.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="#60a5fa" fillOpacity=".6" />
          ))}
          {COINS.map((c) => (
            <g key={c.x}>
              {c.r > 30 && <circle cx={c.x} cy={c.y} r={c.r + 14} fill={c.fill} fillOpacity=".18" />}
              <circle cx={c.x} cy={c.y} r={c.r} fill={c.fill} stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" />
              <path
                d={ICONS[c.icon]}
                transform={`translate(${c.x - c.r * 0.55} ${c.y - c.r * 0.55}) scale(${(c.r * 1.1) / 24})`}
                fill="none"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </svg>
      </div>
      {children && <div className="flex justify-end">{children}</div>}
    </header>
  );
}
