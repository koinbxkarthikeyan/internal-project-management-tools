import Image from "next/image";

type LogoProps = {
  className?: string;
};

// Union.svg has a dark wordmark (light theme); darkLogo.svg has a white one (dark theme).
export default function Logo({ className = "" }: LogoProps) {
  return (
    <span className={`inline-flex ${className}`}>
      <Image
        src="/Union.svg"
        alt="Koinbx"
        width={135}
        height={46}
        priority
        className="h-8 w-auto dark:hidden"
      />
      <Image
        src="/darkLogo.svg"
        alt="Koinbx"
        width={760}
        height={260}
        priority
        className="hidden h-8 w-auto dark:block"
      />
    </span>
  );
}
