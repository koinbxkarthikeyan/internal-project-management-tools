"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fileUrl } from "@/services/messageService";

const SPEEDS = [1, 1.5, 2] as const;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The bars of the waveform-style display: a steady pattern worked out from the file's id (the same voice message always looks the same). */
const barsFor = (id: number, count = 32) => Array.from({ length: count }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin((id + 3) * (i + 1) * 0.73) * Math.cos(i * 0.41 + id)));

/** A voice message: play and pause, a waveform that fills as it plays (click it to skip), the time, playback speed (1x, 1.5x, 2x) and download. `src` overrides the stored file (for a preview before sending). */
export default function VoicePlayer({ id, name, duration, src }: { id: number; name: string; duration?: number; src?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(duration ?? 0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const bars = useMemo(() => barsFor(id), [id]);
  const done = length > 0 ? Math.min(1, time / length) : 0;

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed]);

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => undefined);
    else a.pause();
  }
  const url = src ?? fileUrl(id);
  return (
    <div className="flex w-full max-w-64 min-w-0 items-center gap-2.5">
      {/* The recording's own length is not always in the file (browsers record without it), so the one measured when it was made is used until the player learns it. */}
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => (setPlaying(false), setTime(0))}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0 && setLength(e.currentTarget.duration)}
      />
      <button type="button" onClick={toggle} aria-label={playing ? "Pause voice message" : "Play voice message"} className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {playing ? (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Voice message position"
          aria-valuemin={0}
          aria-valuemax={Math.round(length)}
          aria-valuenow={Math.round(time)}
          className="flex h-7 cursor-pointer items-center gap-[2px]"
          onClick={(e) => {
            const a = audio.current;
            if (!a || !length) return;
            const r = e.currentTarget.getBoundingClientRect();
            a.currentTime = ((e.clientX - r.left) / r.width) * length;
          }}
          onKeyDown={(e) => {
            const a = audio.current;
            if (!a) return;
            if (e.key === "ArrowRight") a.currentTime = Math.min(length, a.currentTime + 5);
            else if (e.key === "ArrowLeft") a.currentTime = Math.max(0, a.currentTime - 5);
          }}
        >
          {bars.map((h, i) => (
            <span key={i} style={{ height: `${Math.round(h * 100)}%` }} className={`w-[3px] shrink-0 rounded-full ${i / bars.length < done ? "bg-accent" : "bg-muted/50"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] tabular-nums text-muted">
          <span>{playing || time > 0 ? clock(time) : clock(length)}</span>
          <span className="flex items-center gap-1.5">
            <button type="button" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} aria-label={`Playback speed ${speed}x`} className="rounded bg-background/70 px-1.5 py-0.5 font-semibold text-foreground hover:bg-border focus-visible:outline-2 focus-visible:outline-accent">{speed}x</button>
            {!src && <a href={fileUrl(id, "download")} download={name} aria-label="Download voice message" className="rounded px-1 py-0.5 hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">Save</a>}
          </span>
        </div>
      </div>
    </div>
  );
}
