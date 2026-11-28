"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/ui/icons";
import { CHAT_LIMITS, extOf, sizeText } from "@/lib/chatConfig";
import FormatToolbar, { shortcut, type Change } from "./FormatToolbar";

export type UploadItem = { key: string; name: string; size: number; kind: "image" | "video" | "audio" | "file"; duration?: number; preview?: string; status: "ready" | "uploading" | "done" | "failed"; progress: number };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * The review step before files are sent, like the upload window of a chat app: the chosen files as a column of small previews, the selected one large with its name and size, a box for a
 * comment, "+ Add files", Cancel and Share. Esc or the ✕ only hides it (the files stay in the message box); Cancel takes the files out.
 */
export default function UploadDialog({
  files,
  comment,
  onComment,
  onRemove,
  onAdd,
  onCancel,
  onShare,
  onClose,
  sending,
  error,
}: {
  files: UploadItem[];
  comment: string;
  onComment: (text: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onCancel: () => void;
  onShare: () => void;
  onClose: () => void;
  sending: boolean;
  error?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState(files[0]?.key);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);
  /** Runs one of the formatting edits on the selected words and puts the cursor back where the edit says. */
  function edit(change: Change) {
    const el = area.current;
    const done = change(comment, el?.selectionStart ?? comment.length, el?.selectionEnd ?? comment.length);
    if (done.text.length > CHAT_LIMITS.textChars) return;
    onComment(done.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(done.from, done.to);
    });
  }
  const current = files.find((f) => f.key === picked) ?? files[0];
  const total = files.reduce((n, f) => n + f.size, 0);
  const busy = sending || files.some((f) => f.status === "uploading");
  const failed = files.some((f) => f.status === "failed");

  return (
    <dialog
      ref={dialog}
      aria-label={`Upload ${files.length} ${files.length === 1 ? "file" : "files"}`}
      onClose={onClose}
      className="card m-auto flex max-h-[92dvh] w-[min(56rem,calc(100vw-2rem))] flex-col overflow-hidden p-0 text-foreground shadow-[var(--elev-modal)] backdrop:bg-black/60"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">Upload {files.length === 1 ? "a file" : `${files.length} files`}</h2>
          <p className="text-xs text-muted">{sizeText(total)} in all</p>
        </div>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" title="Close (the files stay in your message)" className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
          <CloseIcon width={16} height={16} />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-[7rem_minmax(0,1fr)]">
        <ul aria-label="Files to send" className="flex gap-2 overflow-x-auto pb-1 md:max-h-[24rem] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pb-0">
          {files.map((f) => (
            <li key={f.key} className="group/thumb relative shrink-0 self-start">
              <button
                type="button"
                onClick={() => setPicked(f.key)}
                aria-label={`Show ${f.name}`}
                aria-current={f.key === current?.key}
                className={`block size-20 overflow-hidden rounded-lg border bg-hover focus-visible:outline-2 focus-visible:outline-accent md:size-24 ${f.key === current?.key ? "border-accent ring-2 ring-accent/40" : "border-border"}`}
              >
                {f.kind === "image" && f.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt="" className="size-full object-cover" />
                ) : f.kind === "video" && f.preview ? (
                  <video src={f.preview} className="size-full bg-black object-cover" muted preload="metadata" />
                ) : (
                  <span className="grid size-full place-items-center text-xs font-semibold uppercase text-muted">{extOf(f.name) || "file"}</span>
                )}
              </button>
              {!busy && (
                <button type="button" onClick={() => onRemove(f.key)} aria-label={`Remove ${f.name}`} className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/65 text-white opacity-0 transition-opacity group-hover/thumb:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent">
                  <CloseIcon width={10} height={10} />
                </button>
              )}
              {f.status === "uploading" && <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30"><span style={{ width: `${Math.round(f.progress * 100)}%` }} className="block h-full bg-accent transition-[width] duration-150" /></span>}
              {f.status === "failed" && <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/60 text-xs font-semibold text-white">Failed</span>}
            </li>
          ))}
        </ul>

        <div className="flex min-w-0 flex-col gap-3">
          {current && (
            <>
              <div className="grid min-h-48 place-items-center overflow-hidden rounded-xl border border-border bg-hover/60">
                {current.kind === "image" && current.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.preview} alt={current.name} className="max-h-[22rem] w-full object-contain" />
                ) : current.kind === "video" && current.preview ? (
                  <video src={current.preview} controls className="max-h-[22rem] w-full bg-black" />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-8 text-muted">
                    <span className="grid size-16 place-items-center rounded-2xl border border-border bg-surface text-sm font-semibold uppercase text-foreground">{extOf(current.name) || "file"}</span>
                    <span className="text-xs">No preview for this kind of file</span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={current.name}>{current.name}</p>
                <p className="text-xs text-muted">{sizeText(current.size)}{current.duration ? ` · ${clock(current.duration)}` : ""}</p>
              </div>
            </>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="upload-comment" className="text-xs font-medium text-muted">Comment (optional)</label>
            <div className="flex flex-col rounded-xl border border-border bg-background transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_15%,transparent)]">
              <FormatToolbar onEdit={edit} className="border-b border-border">
                <span className="ml-auto pr-1 text-[11px] tabular-nums text-muted">{comment.length}/{CHAT_LIMITS.textChars}</span>
              </FormatToolbar>
              <textarea
                ref={area}
                style={{ outline: "none" }}
                id="upload-comment"
                value={comment}
                onChange={(e) => onComment(e.target.value)}
                onKeyDown={(e) => {
                  const mod = e.ctrlKey || e.metaKey;
                  if (mod && e.key === "Enter" && !busy) {
                    e.preventDefault();
                    onShare();
                  } else {
                    const change = shortcut(e);
                    if (change) {
                      e.preventDefault();
                      edit(change);
                    }
                  }
                }}
                rows={3}
                autoFocus
                maxLength={CHAT_LIMITS.textChars}
                placeholder="Add a comment. Ctrl + Enter to share."
                className="w-full resize-none bg-transparent px-3 py-2 text-sm placeholder:text-muted"
              />
            </div>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
        <button type="button" onClick={onAdd} disabled={busy || files.length >= CHAT_LIMITS.filesPerMessage} className="btn btn-text btn-sm">
          <PlusIcon width={14} height={14} />
          Add files
        </button>
        <div className="flex items-center gap-2">
          {error && <span role="alert" className="mr-1 max-w-[16rem] truncate text-xs text-danger" title={error}>{error}</span>}
          <button type="button" onClick={onCancel} disabled={busy} className="btn btn-secondary">Cancel</button>
          <button type="button" onClick={onShare} disabled={busy} aria-busy={busy} className="btn btn-brand">{busy ? "Uploading…" : failed ? "Retry" : "Share"}</button>
        </div>
      </footer>
    </dialog>
  );
}
