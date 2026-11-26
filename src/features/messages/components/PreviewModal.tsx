"use client";

import { useEffect } from "react";
import ModalClose from "@/components/ui/ModalClose";

/** A plain full-screen viewer for something chosen but not sent yet (a video, a document): its name, the content, and a close button. Esc closes it. */
export default function PreviewModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const keys = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, [onClose]);
  return (
    <div role="dialog" aria-label={`Preview of ${title}`} className="fixed inset-0 z-[80] flex flex-col bg-black/85 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <header className="flex items-center gap-3 pb-3 text-white">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
        <ModalClose onClick={onClose} />
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>{children}</div>
    </div>
  );
}
