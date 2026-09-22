"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Toasts. Plain, short, a little dry — they state what happened, and name the
 * fix when something failed.
 */
type Tone = "default" | "error";
type Toast = { id: number; message: string; detail?: string; tone: Tone };

const ToastContext = createContext<{
  toast: (message: string, options?: { detail?: string; tone?: Tone }) => void;
} | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (message: string, options?: { detail?: string; tone?: Tone }) => {
      const id = nextId++;
      setToasts((list) => [...list, { id, message, detail: options?.detail, tone: options?.tone ?? "default" }]);
      window.setTimeout(
        () => setToasts((list) => list.filter((t) => t.id !== id)),
        options?.tone === "error" ? 6000 : 4000,
      );
    },
    [],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="ui-toast" data-tone={t.tone}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block" }}>{t.message}</span>
              {t.detail && (
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontSize: 12.5,
                    color: "rgba(255,255,255,.7)",
                  }}
                >
                  {t.detail}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside a ToastProvider.");
  return ctx.toast;
}
