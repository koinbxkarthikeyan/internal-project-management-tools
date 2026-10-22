import { formatHours, hoursStanding } from "../utils";

const TONE_TEXT = { below: "text-tone-below", above: "text-tone-above", over: "text-tone-over" } as const;

/**
 * "81h logged · 54h expected so far · 60h total sprint hours · 27h above expected": the numbers stand out from their labels, the logged hours and the
 * standing take the colour of where they are (below expected, above it, over the total), and the standing is always written out too.
 */
export default function HoursSummaryLine({ logged, soFar, total, className = "mt-1 text-xs text-muted" }: { logged: number; soFar: number; total: number; className?: string }) {
  const { tone, label } = hoursStanding(logged, soFar, total);
  return (
    <p className={className}>
      <span className={`font-semibold ${TONE_TEXT[tone]}`}>{formatHours(logged)}</span> logged ·{" "}
      <span className="font-semibold text-foreground">{formatHours(soFar)}</span> expected so far ·{" "}
      <span className="font-semibold text-foreground">{formatHours(total)}</span> total sprint hours ·{" "}
      <span className={`font-semibold ${TONE_TEXT[tone]}`}>{label}</span>
    </p>
  );
}
