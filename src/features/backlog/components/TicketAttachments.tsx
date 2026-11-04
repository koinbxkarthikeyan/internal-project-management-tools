"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/apiClient";
import { onExternalChange } from "@/lib/localApi";
import { imageLog } from "@/lib/imageOptimizer";
import { FORMATS_TEXT, IMAGE_ACCEPT, MAX_IMAGES, addAttachments, optimizeImages, imageUrl, listAttachments, removeAttachment, sizeText, type Attachment } from "@/services/attachmentService";

export type Shown = Attachment & { url?: string };

/** One image at a large size over the page; Escape or a click outside closes it. */
export function Lightbox({ image, onClose }: { image: Shown; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={image.name}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="m-auto max-h-[94dvh] max-w-[94vw] overflow-hidden rounded-2xl border border-border bg-surface p-0 text-foreground shadow-modal backdrop:bg-black/80"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 text-sm">
        <p className="min-w-0 truncate font-medium">{image.name} <span className="font-normal text-muted">· {sizeText(image.size)}{image.originalSize > image.size ? ` (optimized from ${sizeText(image.originalSize)})` : ""}</span></p>
        <button type="button" onClick={() => ref.current?.close()} className="rounded-lg px-2 py-1 text-muted hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Close</button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image.url && <img src={image.url} alt={image.name} className="max-h-[calc(94dvh-3rem)] max-w-[94vw] object-contain" />}
    </dialog>
  );
}

/**
 * The images attached to a Ticket: small previews that open larger, and, for the people who may change the Ticket, Add images and Remove. The files come from the
 * browser's image store, so they are still there after a refresh and whenever the Ticket is opened again.
 */
export default function TicketAttachments({ ticketCode, canEdit }: { ticketCode: string; canEdit: boolean }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<Shown[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const urls = useRef<string[]>([]);

  const load = useCallback(() => {
    listAttachments(ticketCode).then(
      async (rows) => {
        const shown = await Promise.all(rows.map(async (a) => ({ ...a, url: await imageUrl(a.id).catch(() => undefined) })));
        urls.current.forEach((u) => URL.revokeObjectURL(u));
        urls.current = shown.flatMap((s) => (s.url ? [s.url] : []));
        shown.forEach((s) => s.url && imageLog(`Preview URL (temporary): ${s.url} for ${s.name}`));
        setImages(shown);
        setError("");
      },
      (err) => setError(getErrorMessage(err)),
    );
  }, [ticketCode]);
  useEffect(load, [load]);
  useEffect(() => onExternalChange(load), [load]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function add(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const { ok, problems } = await optimizeImages(files, images?.length ?? 0);
      if (problems.length) setError(problems.join(" "));
      else setError("");
      if (ok.length) {
        await addAttachments(ticketCode, ok);
        toast.show(ok.length === 1 ? "Image attached" : `${ok.length} images attached`);
        load();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Shown) {
    try {
      await removeAttachment(a.id);
      toast.show("Image removed");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (images === null && !error) return null;
  if (!canEdit && images?.length === 0 && !error) return null;
  return (
    <section aria-label="Attachments" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">Attachments{images && images.length > 0 ? ` (${images.length})` : ""}</p>
        {canEdit && (images?.length ?? 0) < MAX_IMAGES && (
          <>
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className="h-8 rounded-lg border border-border px-3 text-xs font-semibold text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
              {busy ? "Optimizing…" : "Add images"}
            </button>
            <input ref={input} type="file" multiple accept={IMAGE_ACCEPT} tabIndex={-1} aria-label="Choose images to attach" className="sr-only" onChange={(e) => { void add([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {images && images.length === 0 ? (
        <p className="text-xs text-muted">No images yet. {FORMATS_TEXT}.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {images?.map((a) => (
            <li key={a.id} className="flex flex-col gap-1 rounded-xl border border-border bg-background p-2">
              <button type="button" onClick={() => setOpen(a)} aria-label={`View ${a.name} larger`} className="overflow-hidden rounded-lg bg-hover focus-visible:outline-2 focus-visible:outline-accent">
                {a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="h-24 w-full object-cover transition-transform duration-150 hover:scale-105" />
                ) : (
                  <span className="flex h-24 items-center justify-center text-xs text-muted">Image not available</span>
                )}
              </button>
              <p className="truncate text-xs font-medium" title={a.name}>{a.name}</p>
              <p className="flex items-center justify-between text-[11px] text-muted">
                <span title={a.originalSize > a.size ? `Optimized from ${sizeText(a.originalSize)}` : undefined}>{sizeText(a.size)}</span>
                {canEdit && <button type="button" onClick={() => void remove(a)} className="font-medium text-red-600 hover:underline focus-visible:outline-2 focus-visible:outline-accent dark:text-red-300">Remove</button>}
              </p>
            </li>
          ))}
        </ul>
      )}
      {open && <Lightbox image={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
