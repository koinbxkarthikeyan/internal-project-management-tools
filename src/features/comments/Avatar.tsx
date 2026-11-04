const TONES = [
  "bg-sky-500/20 text-sky-800 dark:text-sky-200",
  "bg-violet-500/20 text-violet-800 dark:text-violet-200",
  "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200",
  "bg-amber-500/20 text-amber-800 dark:text-amber-200",
  "bg-rose-500/20 text-rose-800 dark:text-rose-200",
  "bg-cyan-500/20 text-cyan-800 dark:text-cyan-200",
];

/** A round avatar of the person's initials (people have no profile pictures in this app); each person keeps the same colour, taken from their id. */
export default function Avatar({ name, id, size = "md" }: { name: string; id?: string; size?: "sm" | "md" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  const tone = TONES[[...(id ?? name)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % TONES.length];
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-semibold ${tone} ${size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs"}`}>
      {initials}
    </span>
  );
}
