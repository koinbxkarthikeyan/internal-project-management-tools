"use client";

import type { ReactNode } from "react";
import { linkSelection, prefixLines, wrapSelection, type Edit } from "../formatting";

const line = (d: string) => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
export type Change = (text: string, start: number, end: number) => Edit;

/** The formatting buttons: what each does and the mark it writes (messages show these marks, see RichText). `gap` starts a new group. */
const TOOLS: { label: string; face: ReactNode; look?: string; key?: string; gap?: boolean; run: Change }[] = [
  { label: "Bold", face: "B", look: "font-bold", key: "Ctrl + B", run: (t, a, b) => wrapSelection(t, a, b, "*") },
  { label: "Italic", face: "I", look: "italic", key: "Ctrl + I", run: (t, a, b) => wrapSelection(t, a, b, "_") },
  { label: "Strikethrough", face: "S", look: "line-through", run: (t, a, b) => wrapSelection(t, a, b, "~") },
  { label: "Numbered list", face: line("M10 6h10M10 12h10M10 18h10M4 5l1-1v4M4 13h2l-2 3h2"), gap: true, run: (t, a, b) => prefixLines(t, a, b, "number") },
  { label: "Bulleted list", face: line("M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"), run: (t, a, b) => prefixLines(t, a, b, "bullet") },
  { label: "Quote", face: line("M7 7h4v4c0 3-1 4-3 5M15 7h4v4c0 3-1 4-3 5"), gap: true, run: (t, a, b) => prefixLines(t, a, b, "quote") },
  { label: "Link", face: line("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"), run: linkSelection },
  { label: "Code", face: "</>", look: "font-mono text-xs", run: (t, a, b) => wrapSelection(t, a, b, "`") },
];

/** The row of formatting buttons above a text box. `onEdit` runs the chosen edit on the box's selected words; `children` sit at the right end (a counter). */
export default function FormatToolbar({ onEdit, children, className = "" }: { onEdit: (change: Change) => void; children?: ReactNode; className?: string }) {
  return (
    <div role="toolbar" aria-label="Text formatting" className={`flex items-center gap-0.5 px-2 py-1 ${className}`}>
      {TOOLS.map((t, n) => (
        <span key={t.label} className="contents">
          {t.gap && n > 0 && <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />}
          <button type="button" onClick={() => onEdit(t.run)} aria-label={t.label} title={t.key ? `${t.label} (${t.key})` : t.label} className={`grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-sm text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent ${t.look ?? ""}`}>{t.face}</button>
        </span>
      ))}
      {children}
    </div>
  );
}

/** Ctrl/Cmd + B and I write the bold and italic marks; returns the edit to run, or nothing for any other key. */
export function shortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean }): Change | undefined {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  return k === "b" ? TOOLS[0].run : k === "i" ? TOOLS[1].run : undefined;
}
