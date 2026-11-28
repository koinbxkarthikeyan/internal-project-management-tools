import type { ReactNode } from "react";

/**
 * A message's words: web addresses become links (opened in a new tab), *bold*, _italic_ and `code` are shown as such, and an @name is highlighted. Everything else stays plain text
 * (nothing a person types is ever treated as markup).
 */
export function linkify(text: string): ReactNode[] {
  return text.split(/(\[[^\]\n]+\]\(https?:\/\/[^\s<>"')]+\)|https?:\/\/[^\s<>"']+|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`|@\p{L}[\p{L}\p{N}._-]*)/gu).map((part, i) => {
    if (i % 2 === 0) return part;
    if (part.startsWith("[")) {
      const at = part.lastIndexOf("](");
      return <a key={i} href={part.slice(at + 2, -1)} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{part.slice(1, at)}</a>;
    }
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
    if (part.startsWith("~")) return <s key={i}>{part.slice(1, -1)}</s>;
    if (part.startsWith("`")) return <code key={i} className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
    return <span key={i} className="font-medium text-accent">{part}</span>;
  });
}


const QUOTE = /^> ?(.*)$/;
const BULLET = /^(?:- |• )(.*)$/;
const NUMBER = /^(\d+)[.)] (.*)$/;

/**
 * A message's words with its lines: a run of lines starting "> " is a quote, "- " a bulleted list and "1. " a numbered list; every other line is ordinary text (links, *bold*, _italic_,
 * ~strikethrough~, `code` and @names as in `linkify`). Nothing a person types is ever treated as HTML.
 */
export function richText(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const lines = text.split("\n");
  let plain: string[] = [];
  const flush = () => {
    if (plain.length) out.push(<span key={`p${out.length}`}>{linkify(plain.join("\n"))}</span>);
    plain = [];
  };
  for (let i = 0; i < lines.length; ) {
    const kind = QUOTE.test(lines[i]) ? "quote" : BULLET.test(lines[i]) ? "bullet" : NUMBER.test(lines[i]) ? "number" : null;
    if (!kind) {
      plain.push(lines[i++]);
      continue;
    }
    const re = kind === "quote" ? QUOTE : kind === "bullet" ? BULLET : NUMBER;
    const run: string[] = [];
    const first = kind === "number" ? Number(NUMBER.exec(lines[i])![1]) : 1;
    while (i < lines.length && re.test(lines[i])) run.push(re.exec(lines[i++])!.at(-1)!);
    flush();
    const key = `b${out.length}`;
    if (kind === "quote") out.push(<blockquote key={key} className="my-1 border-l-2 border-border pl-2.5 text-muted">{linkify(run.join("\n"))}</blockquote>);
    else {
      const items = run.map((t, n) => <li key={n}>{linkify(t)}</li>);
      out.push(kind === "bullet" ? <ul key={key} className="my-1 list-disc pl-5">{items}</ul> : <ol key={key} start={first} className="my-1 list-decimal pl-5">{items}</ol>);
    }
  }
  flush();
  return out;
}
