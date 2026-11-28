import { sprintLabel } from "@/constants/backlog-options";
import { SprintIcon, UsersIcon } from "./icons";

/** A name with a small muted icon before it, so a sprint or a team reads at a glance. Nothing is shown for an empty name. */
function Named({ icon, children, className = "" }: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span aria-hidden="true" className="shrink-0 opacity-70">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/** A sprint's name (the Backlog for "Unplanned") with a calendar icon. */
export function SprintName({ name, className }: { name: string; className?: string }) {
  return <Named icon={<SprintIcon width={14} height={14} />} className={className}>{sprintLabel(name)}</Named>;
}

/** A team's name with a people icon. */
export function TeamName({ name, className }: { name: string; className?: string }) {
  return <Named icon={<UsersIcon width={14} height={14} />} className={className}>{name}</Named>;
}
