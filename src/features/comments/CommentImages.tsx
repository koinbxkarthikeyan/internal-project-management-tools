"use client";

import { useEffect, useState } from "react";
import { Lightbox, type Shown } from "@/features/backlog/components/TicketAttachments";
import { imageUrl } from "@/services/attachmentService";
import type { CommentImage } from "@/services/commentService";

/** The images sent with a comment: small thumbnails read from the image store, each opening larger. Temporary addresses are released when they change or this goes away. */
export default function CommentImages({ images }: { images: readonly CommentImage[] }) {
  const [shown, setShown] = useState<Shown[]>([]);
  const [open, setOpen] = useState<Shown | null>(null);
  const key = images.map((i) => i.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    Promise.all(images.map(async (i) => ({ id: i.id, name: i.name, type: i.type, size: i.size, originalSize: i.size, createdAt: "", url: await imageUrl(i.id).catch(() => undefined) }))).then((rows) => {
      rows.forEach((r) => r.url && made.push(r.url));
      if (cancelled) made.forEach((u) => URL.revokeObjectURL(u));
      else setShown(rows);
    });
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
    // `key` stands for the list of images.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (images.length === 0) return null;
  return (
    <>
      <ul className="mt-2 flex flex-wrap gap-2">
        {shown.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => setOpen(a)} aria-label={`View ${a.name} larger`} className="overflow-hidden rounded-lg border border-border bg-hover focus-visible:outline-2 focus-visible:outline-accent">
              {a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.name} className="size-24 object-cover transition-transform duration-150 hover:scale-105" />
              ) : (
                <span className="flex size-24 items-center justify-center text-[11px] text-muted">Not available</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {open && <Lightbox image={open} onClose={() => setOpen(null)} />}
    </>
  );
}
