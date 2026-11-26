"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePresence } from "@/hooks/usePresence";

/**
 * The look of a collapsible panel: its height eases between 0 and its own height (a grid row going 0fr to 1fr) while it fades. The content is clipped only while it moves: once the
 * panel has finished opening it is not clipped, so a calendar or list that pops out of something inside it is not cut off.
 */
export function CollapsePanel({ shown, children, className = "" }: { shown: boolean; children: ReactNode; className?: string }) {
  const [settled, setSettled] = useState(false);
  const [was, setWas] = useState(shown);
  if (was !== shown) {
    setWas(shown);
    if (!shown) setSettled(false);
  }
  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => setSettled(true), 220);
    return () => window.clearTimeout(timer);
  }, [shown]);
  return (
    <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"} ${className}`}>
      <div className={`min-h-0 ${shown && settled ? "" : "overflow-hidden"}`}>{children}</div>
    </div>
  );
}

/** A panel that eases open and closed. Nothing is in the page while it is closed (so it costs nothing and loads nothing), and it stays until the closing animation has played. */
export default function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  const { mounted, shown } = usePresence(open);
  if (!mounted) return null;
  return <CollapsePanel shown={shown} className={className}>{children}</CollapsePanel>;
}

/** The same for a table row that opens under another (`colSpan` cells wide): the row stays until it has eased closed. */
export function CollapseRow({ open, colSpan, className = "", children }: { open: boolean; colSpan: number; className?: string; children: ReactNode }) {
  const { mounted, shown } = usePresence(open);
  if (!mounted) return null;
  return (
    <tr className={className}>
      <td colSpan={colSpan} className="px-3">
        <CollapsePanel shown={shown}>
          <div className="pb-3">{children}</div>
        </CollapsePanel>
      </td>
    </tr>
  );
}
