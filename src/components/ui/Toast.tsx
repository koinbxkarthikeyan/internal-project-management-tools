"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircleIcon, CheckCircleIcon, CloseIcon, TrashIcon } from "@/components/ui/icons";

type Tone = "success" | "info" | "warning" | "danger" | "delete";
type ToastData = { id: number; message: string; tone: Tone; leaving: boolean };

type ToastApi = { show: (message: string, tone?: Tone, durationMs?: number) => void };

const ToastContext = createContext<ToastApi | null>(null);

// Solid, theme-independent colours (text/background contrast: success 5.0, info 6.7, danger 6.5, delete 8.3, warning 11+), so a toast reads the same in light and dark.
const STYLE: Record<Tone, string> = {
  success: "bg-[#15803d] text-white",
  info: "bg-[#1d4ed8] text-white",
  warning: "bg-[#fbbf24] text-[#1c1917]",
  danger: "bg-[#b91c1c] text-white",
  delete: "bg-[#991b1b] text-white",
};
const ICON: Record<Tone, typeof CheckCircleIcon> = {
  success: CheckCircleIcon,
  info: AlertCircleIcon,
  warning: AlertCircleIcon,
  danger: AlertCircleIcon,
  delete: TrashIcon,
};

const DURATION = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counter = useRef(0);
  const layer = useRef<HTMLDivElement>(null);

  // The stack lives in the browser's top layer, so it is above dialogs, dropdowns and side panels and is never clipped by an overflow:hidden parent.
  useEffect(() => {
    const el = layer.current;
    if (!el?.showPopover) return;
    if (el.matches(":popover-open")) el.hidePopover(); // re-open so a newer toast is above popovers opened since
    if (toasts.length > 0) el.showPopover();
  }, [toasts.length]);

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
        ref={layer}
        popover="manual"
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-[60] m-0 flex flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 sm:inset-x-auto sm:right-4 sm:left-auto sm:items-end"
      >
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "danger" || t.tone === "warning" ? "alert" : undefined}
              className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ring-1 ring-black/10 ${STYLE[t.tone]} ${
                t.leaving ? "anim-toast-out" : "anim-toast-in"
              }`}
            >
              <Icon width={18} height={18} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-md p-1 opacity-90 hover:bg-black/15 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-current"
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
