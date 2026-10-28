import Image from "next/image";

type LogoProps = {
  className?: string;
  /** "full": the mark with the KoinBX lettering (sign-in screens). "mark": the play mark alone. "wordmark": the "koinbx" lettering alone (sign-in screens). */
  variant?: "full" | "mark" | "wordmark";
};

// Union.svg has a dark wordmark (light theme); darkLogo.svg has a white one (dark theme). The mark has the same colours in both themes.
export default function Logo({ className = "", variant = "full" }: LogoProps) {
  if (variant === "mark") {
    return (
      <span className={`inline-flex ${className}`}>
        <Image src="/koinbx-mark.svg" alt="Koinbx" width={30} height={46} priority className="h-9 w-auto" />
      </span>
    );
  }
  if (variant === "wordmark") {
    return (
      <span className={`inline-flex ${className}`}>
        <Image src="/koinbx-wordmark.svg" alt="Koinbx" width={96} height={28} priority className="h-10 w-auto object-contain dark:hidden" />
        <Image src="/koinbx-wordmark-dark.svg" alt="Koinbx" width={532} height={150} priority className="hidden h-10 w-auto object-contain dark:block" />
      </span>
    );
  }
  return (
    <span className={`inline-flex ${className}`}>
      <Image src="/Union.svg" alt="Koinbx" width={135} height={46} priority className="h-8 w-auto dark:hidden" />
      <Image src="/darkLogo.svg" alt="Koinbx" width={760} height={260} priority className="hidden h-8 w-auto dark:block" />
    </span>
  );
}
