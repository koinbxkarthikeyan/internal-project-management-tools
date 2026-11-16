/**
 * A person's name with an icon that says what they are on the task: an Owner (a briefcase, accent colour) or a user, i.e. a Lead or an assignee
 * (a person, slate). The icon sits in the same round chip the owner initials used.
 */
type Kind = "owner" | "user";

const PATHS: Record<Kind, React.ReactNode> = {
  owner: (
    <>
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M4 13h16" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </>
  ),
};

const CHIP: Record<Kind, string> = {
  owner: "bg-accent-soft text-accent",
  user: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",
};

export function PersonIcon({ kind, size = 24 }: { kind: Kind; size?: number }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full ${CHIP[kind]}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {PATHS[kind]}
      </svg>
    </span>
  );
}

export default function PersonLabel({ kind, name, size = 24, className = "" }: { kind: Kind; name: string; size?: number; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`} title={kind === "owner" ? `Owner: ${name}` : `User: ${name}`}>
      <PersonIcon kind={kind} size={size} />
      <span className="truncate">{name}</span>
    </span>
  );
}
