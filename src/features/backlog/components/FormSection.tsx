import type { ReactNode } from "react";

/**
 * One group of related fields in a large form: a small heading (and a short line of help when it helps) over the fields, which sit in two columns when the section itself is wide enough (a container query, so a
 * section in a half-width column stays in one) and one when not. A field that needs the whole row takes `@sm:col-span-2`.
 */
export default function FormSection({ title, hint, children, className = "", gridClassName = "" }: { title: string; hint?: string; children: ReactNode; className?: string; gridClassName?: string }) {
  return (
    <section aria-label={title} className={`@container flex flex-col gap-3 rounded-xl border border-border/70 bg-background/40 p-4 ${className}`}>
      <header>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </header>
      <div className={`grid gap-4 @sm:grid-cols-2 ${gridClassName}`}>{children}</div>
    </section>
  );
}
