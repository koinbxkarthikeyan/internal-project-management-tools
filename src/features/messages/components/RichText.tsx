import type { ReactNode } from "react";

/**
 * A message's words: web addresses become links (opened in a new tab), *bold*, _italic_ and `code` are shown as such, and an @name is highlighted. Everything else stays plain text
 * (nothing a person types is ever treated as markup).
 */
export function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s<>"']+|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|@\p{L}[\p{L}\p{N}._-]*)/gu).map((part, i) => {
    if (i % 2 === 0) return part;
    if (part.startsWith("http")) {
      const url = part.replace(/[.,;:!?)]+$/, "");
      return (
        <span key={i}>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{url}</a>
          {part.slice(url.length)}
        </span>
      );
    }
    if (part.startsWith("*")) return <strong key={i} className="font-semibold">{part.slice(1, -1)}</strong>;
    if (part.startsWith("_")) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`")) return <code key={i} className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
    return <span key={i} className="font-medium text-accent">{part}</span>;
  });
}

