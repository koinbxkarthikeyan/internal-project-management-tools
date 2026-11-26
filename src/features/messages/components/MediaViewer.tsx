"use client";

import { useEffect, useState } from "react";
import ModalClose from "@/components/ui/ModalClose";
import { fileUrl } from "@/services/messageService";

/** A picture to show: a sent file (by id) or one chosen but not sent yet (its local `url`). */
export type Viewable = { id: number; name: string; url?: string };

/** Full-size view of a picture: zoom in and out (buttons, the + and − keys, or the mouse wheel), drag the zoomed picture, step through a message's pictures with ← →, and download. Esc closes it. */
export default function MediaViewer({ files, start, onClose }: { files: Viewable[]; start: number; onClose: () => void }) {
  const [at, setAt] = useState(start);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const file = files[at];
  const to = (n: number) => (setAt(n), setZoom(1), setPan({ x: 0, y: 0 }));
  const zoomBy = (f: number) => setZoom((z) => Math.min(6, Math.max(1, +(z * f).toFixed(2))));

  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && at < files.length - 1) to(at + 1);
      else if (e.key === "ArrowLeft" && at > 0) to(at - 1);
      else if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(0.8);
    };
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  });

  const btn = "grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-semibold text-white/90 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40";
  return (
    <div role="dialog" aria-label={`Picture ${file.name}`} className="fixed inset-0 z-[80] flex flex-col bg-black/90" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <header className="flex items-center gap-2 px-4 py-2 text-white">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}{files.length > 1 && <span className="ml-2 text-white/60">{at + 1} / {files.length}</span>}</p>
        <button type="button" onClick={() => zoomBy(0.8)} disabled={zoom <= 1} aria-label="Zoom out" className={btn}>−</button>
        <span className="w-12 text-center text-xs tabular-nums text-white/70">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1.25)} disabled={zoom >= 6} aria-label="Zoom in" className={btn}>+</button>
        {!file.url && <a href={fileUrl(file.id, "download")} download={file.name} aria-label="Download" className={btn}>Download</a>}
        <ModalClose onClick={onClose} />
      </header>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.15 : 0.87)}
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.url ?? fileUrl(file.id)}
          alt={file.name}
          draggable={false}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, cursor: zoom > 1 ? "grab" : "default" }}
          className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
          onPointerDown={(e) => {
            if (zoom <= 1) return;
            const start = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            const move = (m: PointerEvent) => setPan({ x: m.clientX - start.x, y: m.clientY - start.y });
            const up = () => (window.removeEventListener("pointermove", move), window.removeEventListener("pointerup", up));
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        />
        {at > 0 && <button type="button" onClick={() => to(at - 1)} aria-label="Previous picture" className={`${btn} absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-xl`}>‹</button>}
        {at < files.length - 1 && <button type="button" onClick={() => to(at + 1)} aria-label="Next picture" className={`${btn} absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-xl`}>›</button>}
      </div>
    </div>
  );
}
