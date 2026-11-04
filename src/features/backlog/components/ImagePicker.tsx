"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { imageLog } from "@/lib/imageOptimizer";
import { FORMATS_TEXT, IMAGE_ACCEPT, MAX_IMAGES, optimizeImages, sizeText, type OptimizedImage } from "@/services/attachmentService";

/**
 * Choosing images in a form: add one or more (any size: each is optimized to about 20 KB as it is chosen), see a preview of the optimized result, and remove or
 * replace any of them. Previews are temporary addresses made here and released when an image goes or the form closes; the optimized files themselves are saved by
 * whoever owns the form, as real image attachments.
 */
export default function ImagePicker({ files, onChange }: { files: OptimizedImage[]; onChange: (files: OptimizedImage[]) => void }) {
  const add = useRef<HTMLInputElement>(null);
  const replace = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<number | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f.file)), [files]);
  useEffect(() => {
    previews.forEach((u, i) => imageLog(`Preview URL (temporary): ${u} for ${files[i].file.name}`));
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews, files]);

  async function take(chosen: File[], replaceAt: number | null) {
    setBusy(true);
    const { ok, problems: bad } = await optimizeImages(chosen, replaceAt == null ? files.length : files.length - 1).finally(() => setBusy(false));
    setProblems(bad);
    if (ok.length === 0) return;
    if (replaceAt != null) imageLog(`Image replaced: ${files[replaceAt].file.name} → ${ok[0].file.name}`);
    onChange(replaceAt == null ? [...files, ...ok] : files.map((f, i) => (i === replaceAt ? ok[0] : f)));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted">Images</p>
      <div
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take([...e.dataTransfer.files], null);
        }}
        className={`flex flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-4 text-center transition-colors ${over ? "border-accent bg-accent-soft" : "border-border"}`}
      >
        <button type="button" disabled={busy} onClick={() => add.current?.click()} className="h-9 rounded-lg border border-border px-4 text-sm font-medium text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
          {busy ? "Optimizing…" : "Add images"}
        </button>
        <p className="text-xs text-muted">or drop them here · {FORMATS_TEXT}, any size · optimized to about 20 KB each · at most {MAX_IMAGES}</p>
      </div>
      <input
        ref={add}
        type="file"
        multiple
        accept={IMAGE_ACCEPT}
        tabIndex={-1}
        aria-label="Choose images"
        className="sr-only"
        onChange={(e) => {
          void take([...(e.target.files ?? [])], null);
          e.target.value = "";
        }}
      />
      <input
        ref={replace}
        type="file"
        accept={IMAGE_ACCEPT}
        tabIndex={-1}
        aria-label="Choose a replacement image"
        className="sr-only"
        onChange={(e) => {
          if (replacing != null) void take([...(e.target.files ?? [])].slice(0, 1), replacing);
          setReplacing(null);
          e.target.value = "";
        }}
      />
      {problems.length > 0 && (
        <ul role="alert" className="flex flex-col gap-0.5 text-sm text-red-700 dark:text-red-300">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((f, i) => (
            <li key={`${f.file.name}-${f.file.size}-${i}`} className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt={`Preview of ${f.file.name}`} className="h-24 w-full rounded-lg bg-hover object-cover" />
              <p className="truncate text-xs font-medium" title={f.file.name}>{f.file.name}</p>
              <p className="text-[11px] text-muted" title={f.reachedTarget ? undefined : "Kept above 20 KB so the image stays clear"}>
                {f.unchanged ? `${sizeText(f.file.size)} · already small` : `${sizeText(f.originalSize)} → ${sizeText(f.file.size)}`}
              </p>
              <p className="text-[11px] text-muted">{f.width} × {f.height}{f.width !== f.originalWidth ? ` (from ${f.originalWidth} × ${f.originalHeight})` : ""}</p>
              <div className="flex gap-2 text-xs font-medium">
                <button type="button" onClick={() => (setReplacing(i), replace.current?.click())} className="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">Replace</button>
                <button type="button" onClick={() => (imageLog(`Image removed: ${f.file.name}`), onChange(files.filter((_, k) => k !== i)))} className="text-red-600 hover:underline focus-visible:outline-2 focus-visible:outline-accent dark:text-red-300">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
