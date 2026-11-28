/** Text edits for the comment box's formatting buttons. Each takes the text and the selection (`start`, `end`) and returns the new text with the selection to restore. The marks are the ones messages show (see RichText). */
export type Edit = { text: string; from: number; to: number };

/** *bold*, _italic_, ~strikethrough~, `code`: the mark goes round the selection, or round the word "text" (kept selected to be typed over) when nothing is selected. */
export function wrapSelection(text: string, start: number, end: number, mark: string): Edit {
  const word = text.slice(start, end) || "text";
  return { text: `${text.slice(0, start)}${mark}${word}${mark}${text.slice(end)}`, from: start + mark.length, to: start + mark.length + word.length };
}

/** A link is written [words](https://address). A selected web address becomes the address (the words "link" are selected to be typed over); other selected words keep their place and the address is left selected for pasting. */
export function linkSelection(text: string, start: number, end: number): Edit {
  const picked = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);
  if (/^https?:\/\/\S+$/.test(picked)) {
    return { text: `${before}[link](${picked})${after}`, from: start + 1, to: start + 5 };
  }
  const label = picked || "link";
  const at = start + label.length + 3;
  return { text: `${before}[${label}](https://)${after}`, from: at, to: at + "https://".length };
}

type ListKind = "bullet" | "number" | "quote";
const ANY = /^(?:- |• |\d+[.)] |> ?)/;
const OWN: Record<ListKind, RegExp> = { bullet: /^(?:- |• )/, number: /^\d+[.)] /, quote: /^> ?/ };

/** The lines the selection touches become a bulleted list ("- "), a numbered list ("1. ") or a quote ("> "); pressing it again on lines that already are one takes it off. */
export function prefixLines(text: string, start: number, end: number, kind: ListKind): Edit {
  const from = text.lastIndexOf("\n", Math.max(0, start) - 1) + 1;
  const stop = text.indexOf("\n", end);
  const to = stop === -1 ? text.length : stop;
  const lines = text.slice(from, to).split("\n");
  const off = lines.every((l) => OWN[kind].test(l));
  const next = lines.map((l, i) => {
    const bare = l.replace(ANY, "");
    if (off) return bare;
    return `${kind === "bullet" ? "- " : kind === "number" ? `${i + 1}. ` : "> "}${bare}`;
  });
  const block = next.join("\n");
  return { text: `${text.slice(0, from)}${block}${text.slice(to)}`, from, to: from + block.length };
}
