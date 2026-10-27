import Image from "next/image";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Smaller version for cards and sections. */
  compact?: boolean;
  /** One-line version (small icon beside the text) for rows inside a list. */
  inline?: boolean;
};

/**
 * Empty-table placeholder. Colours come from the theme tokens, which are derived from the
 * KoinBX logo (blue in light theme, cyan in dark); the badge is the logo mark itself.
 */
export default function EmptyState({ title, description, action, compact = false, inline = false }: EmptyStateProps) {
  if (inline) {
    return (
      <div className="anim-fade-up mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2">
        <span className="relative shrink-0">
          <svg viewBox="0 0 220 150" width={44} height={30} role="img" aria-label="Empty table">
            <rect x="30" y="18" width="160" height="108" rx="12" className="fill-surface stroke-border" strokeWidth="6" />
            <rect x="30" y="18" width="160" height="30" rx="12" className="fill-accent-soft" />
            {[66, 86, 106].map((y) => (
              <rect key={y} x="46" y={y} width="128" height="10" rx="5" className="fill-hover" />
            ))}
          </svg>
          <Image src="/koinbx-mark.svg" alt="" width={9} height={14} className="absolute -bottom-0.5 -right-1" />
        </span>
        <p className="min-w-0 text-xs">
          <span className="font-semibold">{title}</span>
          {description && <span className="text-muted"> · {description}</span>}
        </p>
      </div>
    );
  }
  return (
    <div className={`anim-fade-up flex flex-col items-center px-6 text-center ${compact ? "py-6" : "py-12"}`}>
      <div className="relative">
        <svg viewBox="0 0 220 150" width={compact ? 150 : 220} height={compact ? 102 : 150} role="img" aria-label="Empty table" className="max-w-full">
          {/* soft backdrop */}
          <ellipse cx="110" cy="136" rx="78" ry="8" className="fill-accent-soft" />
          <circle cx="36" cy="40" r="4" className="fill-accent-soft" />
          <circle cx="192" cy="28" r="6" className="fill-accent-soft" />
          <circle cx="200" cy="96" r="3" className="fill-accent" opacity="0.5" />
          {/* empty table card */}
          <rect x="30" y="18" width="160" height="108" rx="12" className="fill-surface stroke-border" strokeWidth="2" />
          <path d="M30 42h160" className="stroke-border" strokeWidth="2" />
          <rect x="30" y="18" width="160" height="24" rx="12" className="fill-accent-soft" />
          <rect x="30" y="30" width="160" height="12" className="fill-accent-soft" />
          <rect x="44" y="26" width="34" height="6" rx="3" className="fill-accent" opacity="0.55" />
          <rect x="92" y="26" width="24" height="6" rx="3" className="fill-accent" opacity="0.35" />
          <rect x="130" y="26" width="30" height="6" rx="3" className="fill-accent" opacity="0.35" />
          {/* skeleton rows */}
          {[58, 78, 98].map((y, i) => (
            <g key={y} opacity={1 - i * 0.28}>
              <rect x="44" y={y} width="62" height="7" rx="3.5" className="fill-hover" />
              <rect x="118" y={y} width="22" height="7" rx="3.5" className="fill-hover" />
              <rect x="150" y={y} width="26" height="7" rx="3.5" className="fill-hover" />
            </g>
          ))}
        </svg>
        {/* KoinBX mark badge */}
        <span
          className={`absolute -bottom-1 flex items-center justify-center rounded-2xl border border-border bg-surface shadow-lg ${
            compact ? "right-3 h-10 w-10" : "right-6 h-14 w-14"
          }`}
        >
          <Image src="/koinbx-mark.svg" alt="KoinBX" width={compact ? 16 : 24} height={compact ? 25 : 37} />
        </span>
      </div>

      <h3 className={`font-semibold ${compact ? "mt-4 text-sm" : "mt-5 text-base"}`}>{title}</h3>
      {description && <p className={`mt-1 max-w-sm text-muted ${compact ? "text-xs" : "text-sm"}`}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
