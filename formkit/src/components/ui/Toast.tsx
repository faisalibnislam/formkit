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
 * Toasts. Plain, short, a little dry - they state what happened, and name the
 * fix when something failed.
 */
type Tone = "default" | "error";
type Action = { label: string; onClick: () => void };
type Options = { detail?: string; tone?: Tone; action?: Action };
type Toast = { id: number; message: string; detail?: string; tone: Tone; action?: Action };

const ToastContext = createContext<{
  toast: (message: string, options?: Options) => void;
} | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (message: string, options?: Options) => {
      const id = nextId++;
      setToasts((list) => [
        ...list,
        { id, message, detail: options?.detail, tone: options?.tone ?? "default", action: options?.action },
      ]);
      window.setTimeout(
        () => setToasts((list) => list.filter((t) => t.id !== id)),
        options?.tone === "error" || options?.action ? 7000 : 4000,
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
                    color: "var(--color-text-inverse-secondary)",
                  }}
                >
                  {t.detail}
                </span>
              )}
            </span>
            {t.action && (
              <button
                type="button"
                className="ui-toast-action"
                onClick={() => {
                  t.action!.onClick();
                  setToasts((list) => list.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
            {t.action && (
              <button
                type="button"
                className="ui-toast-close"
                aria-label="Dismiss"
                onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
              >
                ×
              </button>
            )}
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
