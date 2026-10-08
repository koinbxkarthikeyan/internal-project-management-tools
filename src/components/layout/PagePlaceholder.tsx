import type { CSSProperties } from "react";
import PageHeader from "@/components/layout/PageHeader";

type PagePlaceholderProps = {
  title: string;
  description: string;
};

export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <section style={{ "--i": 1 } as CSSProperties} className="anim-fade-up flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <h2 className="text-base font-medium">{title} coming soon</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">
          This section is a placeholder. Its content will be built in a later phase.
        </p>
      </section>
    </div>
  );
}
