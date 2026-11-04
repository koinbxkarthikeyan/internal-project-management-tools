import Link from "next/link";
import Logo from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo variant="full" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-muted">The page you opened doesn&apos;t exist, or its address has changed.</p>
      </div>
      <Link href="/" className="btn-brand rounded-xl px-5 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        Go to the app
      </Link>
    </main>
  );
}
