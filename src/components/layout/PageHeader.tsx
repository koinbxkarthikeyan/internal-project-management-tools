import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /**
   * On a phone (under 640px) keep the title and the actions on ONE row (the title shortens with "…", the actions stay) with the description on its own row under them. From sm up the
   * header is the usual one: the text on the left, the actions on the right.
   */
  oneLine?: boolean;
};

export default function PageHeader({ title, description, actions, oneLine = false }: PageHeaderProps) {
  if (oneLine)
    return (
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
        <div className="contents sm:block sm:min-w-0 sm:flex-1 sm:basis-72">
          <h1 className="row-start-1 min-w-0 truncate text-2xl font-semibold tracking-tight sm:overflow-visible sm:whitespace-normal">{title}</h1>
          {description && <div className="col-span-2 row-start-2 min-w-0 text-sm text-muted sm:col-auto sm:row-auto sm:mt-1">{description}</div>}
        </div>
        {actions && <div className="col-start-2 row-start-1 shrink-0 sm:col-auto sm:row-auto">{actions}</div>}
      </header>
    );
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      {/* The text takes the free width (so a long description doesn't push the action down); it wraps under only on narrow screens. */}
      <div className="min-w-0 flex-1 basis-72">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}
