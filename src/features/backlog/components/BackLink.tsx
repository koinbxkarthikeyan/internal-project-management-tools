import Link from "next/link";
import { ChevronLeftIcon } from "@/components/ui/icons";

/** "Back to ..." above a full-page view. */
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1 rounded-lg text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
      <ChevronLeftIcon width={16} height={16} /> {label}
    </Link>
  );
}
