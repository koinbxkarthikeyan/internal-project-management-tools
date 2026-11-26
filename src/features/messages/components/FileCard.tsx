"use client";

import { useState } from "react";
import { extOf, sizeText } from "@/lib/chatConfig";
import { fileUrl, type ChatFile } from "@/services/messageService";

const TONE: Record<string, string> = { pdf: "bg-red-500/15 text-red-600 dark:text-red-300", doc: "bg-blue-500/15 text-blue-600 dark:text-blue-300", docx: "bg-blue-500/15 text-blue-600 dark:text-blue-300", xls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", xlsx: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", csv: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", ppt: "bg-orange-500/15 text-orange-600 dark:text-orange-300", pptx: "bg-orange-500/15 text-orange-600 dark:text-orange-300", zip: "bg-amber-500/15 text-amber-600 dark:text-amber-300", rar: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };

/** A file in a message: its type badge, name and size, "Download", and a preview that opens inside the chat for PDFs and plain text (other types are download-only). */
export default function FileCard({ file }: { file: ChatFile }) {
  const [preview, setPreview] = useState(false);
  const ext = extOf(file.name);
  const previewable = file.type === "application/pdf" || file.type === "text/plain" || ext === "txt" || ext === "log";
  return (
    <div className="w-72 max-w-full overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-lg text-[10px] font-bold uppercase ${TONE[ext] ?? "bg-hover text-muted"}`}>{ext || "file"}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium" title={file.name}>{file.name}</span>
          <span className="block text-xs text-muted">{ext.toUpperCase()} · {sizeText(file.size)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs font-medium">
          <a href={fileUrl(file.id, "download")} download={file.name} className="rounded px-1.5 py-0.5 text-accent hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent">Download</a>
          {previewable && <button type="button" onClick={() => setPreview(!preview)} aria-expanded={preview} className="rounded px-1.5 py-0.5 text-muted hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">{preview ? "Hide" : "Preview"}</button>}
        </span>
      </div>
      {preview && (
        // Text is shown in a sandboxed frame, so what is inside it can't run or reach the app; a PDF needs the browser's own viewer, which does not work in a sandbox.
        <iframe src={fileUrl(file.id)} title={`Preview of ${file.name}`} {...(file.type === "application/pdf" ? {} : { sandbox: "" })} className="h-72 w-full border-t border-border bg-white" />
      )}
    </div>
  );
}
