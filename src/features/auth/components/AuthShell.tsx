import type { ReactNode } from "react";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

type AuthShellProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

/** Centered card used by the login screens; responsive from phones up. */
export default function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <main className="anim-page-in w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
          <div className="mt-6">{children}</div>
        </section>
      </main>
    </div>
  );
}
