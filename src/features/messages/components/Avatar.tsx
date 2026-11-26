const hue = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

/** A round badge with a person's initials; the colour comes from the name, so the same person looks the same everywhere. */
export default function Avatar({ name, size = 32, ring = false }: { name: string; size?: number; ring?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: `hsl(${hue(name)} 55% 42%)` }}
      className={`grid shrink-0 select-none place-items-center rounded-full font-semibold leading-none text-white ${ring ? "ring-2 ring-surface" : ""}`}
    >
      {initials(name)}
    </span>
  );
}
