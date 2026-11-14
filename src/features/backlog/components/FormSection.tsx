import type { ReactNode } from "react";

/**
 * One group of related fields in a large form: a small heading (and a short line of help when it helps) over the fields, which sit in two columns on a wide screen and one on a
 * small one. A field that needs the whole row takes `sm:col-span-2`.
 */
export default function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/40 p-4">
      <header>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </header>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
