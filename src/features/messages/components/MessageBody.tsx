"use client";

import { useState } from "react";
import { sizeText } from "@/lib/chatConfig";
import { fileUrl, type ChatMessage } from "@/services/messageService";
import CodeBlock from "./CodeBlock";
import FileCard from "./FileCard";
import MediaViewer from "./MediaViewer";
import { richText } from "./RichText";
import VoicePlayer from "./VoicePlayer";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The content of a message, drawn for its kind: text, pictures (opening full size), a video with its player, a voice message, a code block, or file cards; with the caption under media. */
export default function MessageBody({ m, onOpenTicket }: { m: ChatMessage; /** Opens the Ticket a "created Ticket …" note points to. */ onOpenTicket?: (ticket: { id: number; code: string }) => void }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const files = m.files ?? [];
  const kind = m.kind ?? (files[0]?.kind === "image" ? "image" : undefined);
  const caption = m.text ? <span className="block min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{richText(m.text)}</span> : null;

  if (m.kind === "code") return <CodeBlock code={m.text} lang={m.lang ?? "javascript"} />;

  if (kind === "image" && files.length) {
    const cols = files.length === 1 ? "grid-cols-1" : "grid-cols-2";
    return (
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className={`grid ${cols} gap-1 overflow-hidden rounded-lg ${files.length === 1 ? "max-w-72" : "max-w-80"}`}>
          {files.map((f, i) => (
            <button key={f.id} type="button" onClick={() => setViewing(i)} aria-label={`Open picture ${f.name}`} className="block overflow-hidden bg-background focus-visible:outline-2 focus-visible:outline-accent">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url ?? fileUrl(f.id)} alt={f.name} loading="lazy" className={`w-full object-cover ${files.length === 1 ? "max-h-72" : "h-32"}`} />
            </button>
          ))}
        </span>
        {caption}
        {viewing !== null && <MediaViewer files={files.map((f) => ({ id: f.id, name: f.name, url: f.url }))} start={viewing} onClose={() => setViewing(null)} />}
      </span>
    );
  }

  if (m.kind === "video" && files.length) {
    return (
      <span className="flex min-w-0 flex-col gap-2">
        {files.map((f) => (
          <span key={f.id} className="flex flex-col gap-1">
            {/* preload="metadata": only the start of the video is fetched (its first frame is the thumbnail); the rest is read when it is played, and skipping works. */}
            <video src={fileUrl(f.id)} controls preload="metadata" playsInline className="max-h-72 w-full max-w-80 rounded-lg bg-black" aria-label={`Video ${f.name}`} />
            <span className="flex items-center justify-between gap-3 text-xs text-muted">
              <span className="truncate">{f.name} · {f.duration ? `${clock(f.duration)} · ` : ""}{sizeText(f.size)}</span>
              <a href={fileUrl(f.id, "download")} download={f.name} className="shrink-0 font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">Download</a>
            </span>
          </span>
        ))}
        {caption}
      </span>
    );
  }

  if (m.kind === "audio" && files.length) {
    return (
      <span className="flex min-w-0 flex-col gap-1.5">
        {files.map((f) => <VoicePlayer key={f.id} id={f.id} name={f.name} duration={f.duration} />)}
        {caption}
      </span>
    );
  }

  if (m.kind === "file" && files.length) {
    return (
      <span className="flex min-w-0 flex-col gap-1.5">
        {files.map((f) => <FileCard key={f.id} file={f} />)}
        {caption}
      </span>
    );
  }

  return (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{richText(m.text)}</span>
      {m.ticket && onOpenTicket && (
        <button type="button" onClick={() => onOpenTicket(m.ticket!)} className="w-fit rounded-md border border-accent/40 bg-accent-soft px-2 py-0.5 font-mono text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">Open {m.ticket.code}</button>
      )}
    </span>
  );
}
