"use client";

import { useState } from "react";
import { CODE_LANGUAGES } from "@/lib/chatConfig";
import { highlight } from "../highlight";

const COLOURS = {
  comment: "italic text-muted",
  string: "text-emerald-600 dark:text-emerald-400",
  number: "text-amber-600 dark:text-amber-400",
  keyword: "text-violet-600 dark:text-violet-400",
  tag: "text-sky-600 dark:text-sky-400",
} as const;

/** How many lines a code block shows before "Show all". */
const COLLAPSED_LINES = 12;

/** A code message: the language, a copy button, the code in a monospace block with its indentation and colours, and long code folded behind "Show all". It is only ever shown, never run. */
export default function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  const long = lines.length > COLLAPSED_LINES;
  const shown = long && !open ? lines.slice(0, COLLAPSED_LINES).join("\n") : code;
  const label = CODE_LANGUAGES.find((l) => l.value === lang)?.label ?? lang;
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: nothing to do
    }
  }
  return (
    <figure className="w-full min-w-0 max-w-[34rem] overflow-hidden rounded-lg border border-border bg-background">
      <figcaption className="flex items-center justify-between gap-2 border-b border-border bg-hover px-3 py-1.5 text-xs">
        <span className="font-semibold uppercase tracking-wide text-muted">{label}</span>
        <button type="button" onClick={() => void copy()} aria-label="Copy code" className="rounded px-1.5 py-0.5 font-medium text-muted hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">{copied ? "Copied" : "Copy"}</button>
      </figcaption>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed"><code>
        {highlight(shown, lang).map((p, i) => (p.kind ? <span key={i} className={COLOURS[p.kind]}>{p.text}</span> : p.text))}
      </code></pre>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full border-t border-border px-3 py-1 text-center text-xs font-medium text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">
          {open ? "Show less" : `Show all ${lines.length} lines`}
        </button>
      )}
    </figure>
  );
}
