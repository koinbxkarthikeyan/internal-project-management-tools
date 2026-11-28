import type { ReactNode } from "react";

/**
 * One block of the Settings page, all alike: a title and a short line, the content under it, and (when there are actions) a footer band with the buttons on the right.
 * Rounded and bordered like the rest of the app, kept compact so the page uses its space; the footer is divided from the content by a thin line.
 */
export default function SettingsCard({ title, description, footer, children, className = "", label }: { title: string; description?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string; /** The name a screen reader gives the block, when it should differ from the title. */ label?: string }) {
  return (
    <section aria-label={label ?? title} className={`flex flex-col overflow-hidden card ${className}`}>
      <header className="px-5 pt-4">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {description && <p className="mt-0.5 truncate text-sm text-muted">{description}</p>}
      </header>
      <div className="flex flex-1 flex-col gap-3 px-5 py-3.5">{children}</div>
      {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
    </section>
  );
}
