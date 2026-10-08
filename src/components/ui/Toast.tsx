"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";

type Tone = "success" | "info" | "danger";
type ToastData = { id: number; message: string; tone: Tone; leaving: boolean };

type ToastApi = { show: (message: string, tone?: Tone, durationMs?: number) => void };

const ToastContext = createContext<ToastApi | null>(null);

const DOT: Record<Tone, string> = {
  success: "bg-emerald-500",
  info: "bg-accent",
  danger: "bg-red-500",
};

const DURATION = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 200);
  }, []);

  const show = useCallback(
    (message: string, tone: Tone = "success", durationMs: number = DURATION) => {
      const id = counter.current++;
      // The same message is never stacked twice while it is still showing.
      setToasts((t) => (t.some((x) => x.message === message && !x.leaving) ? t : [...t.slice(-2), { id, message, tone, leaving: false }]));
      setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  // Stable value: consumers never re-render when toasts appear or disappear.
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-lg ${
              t.leaving ? "anim-toast-out" : "anim-toast-in"
            }`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[t.tone]}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-1 text-muted hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
            >
              <CloseIcon width={14} height={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
