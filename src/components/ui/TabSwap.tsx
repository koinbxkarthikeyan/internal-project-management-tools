import type { ReactNode } from "react";

/**
 * The content of one tab (or one view of a List / Board switch). When `id` changes the content is replaced and the new one fades and slides in a little (`anim-tab-in`), so a tab
 * change is a smooth hand-over and not a jump. Put it around only the part that changes.
 */
export default function TabSwap({ id, className = "", children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <div key={id} className={`anim-tab-in ${className}`}>
      {children}
    </div>
  );
}
