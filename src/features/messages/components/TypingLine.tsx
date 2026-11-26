/** "Name is typing…" under the messages, with three small bouncing dots. Nothing is drawn when nobody is typing. A POD with two or more people typing says how many. */
export default function TypingLine({ names, direct, compact = false }: { names: string[]; direct: boolean; compact?: boolean }) {
  if (names.length === 0) return null;
  const text = names.length === 1 || direct ? `${names[0]} is typing` : `${names.length} people are typing`;
  return (
    <p role="status" className={`flex items-center gap-1.5 text-xs text-muted ${compact ? "px-2 pb-1" : "px-4 pb-1.5"}`}>
      <span aria-hidden="true" className="typing-dots inline-flex items-center gap-0.5">
        <i /><i /><i />
      </span>
      <span className="truncate">{text}…</span>
    </p>
  );
}
