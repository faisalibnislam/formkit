"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

/**
 * Formkit's control primitives.
 *
 * These mirror the design system's components rather than re-deriving their
 * look: every control is a pill, icon buttons are circles, and nothing is
 * outlined that a shadow can hold. Styling lives in src/styles/ui.css.
 */

/* ---------- button ---------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, iconLeft, iconRight, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={`ui-btn ${rest.className ?? ""}`}
      data-variant={variant}
      data-size={size}
      data-full={fullWidth ? "true" : undefined}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});

export function IconButton({
  label,
  tone,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "danger" }) {
  // Every icon-only control takes a required label.
  return (
    <button
      type="button"
      {...rest}
      className={`ui-iconbtn ${rest.className ?? ""}`}
      data-tone={tone}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

/* ---------- fields ---------- */

export function Field({
  label,
  help,
  error,
  action,
  children,
}: {
  label?: string;
  help?: string;
  error?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ui-field">
      {(label || action) && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          {label && (
            <span className="ui-label" style={{ flex: 1 }}>
              {label}
            </span>
          )}
          {action}
        </div>
      )}
      {children}
      {help && !error && <span className="ui-help">{help}</span>}
      {error && <span className="ui-error">{error}</span>}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
  /** Sits after the field — a unit, or the shortcut that opens it. */
  trailing?: ReactNode;
  invalid?: boolean;
  inputSize?: "sm" | "md";
  /** Sizing belongs on the pill, not on the bare input inside it. */
  wrapStyle?: CSSProperties;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, trailing, invalid, inputSize = "md", wrapStyle, ...rest },
  ref,
) {
  return (
    <span
      className="ui-input-wrap"
      data-size={inputSize}
      data-invalid={invalid || undefined}
      style={wrapStyle}
    >
      {icon}
      <input ref={ref} {...rest} />
      {trailing}
    </span>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea(props, ref) {
  return <textarea ref={ref} {...props} className={`ui-textarea ${props.className ?? ""}`} />;
});

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  hideLabel,
}: {
  label: ReactNode;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The box alone, in a table cell whose column heading already names it.
      The label is still written down, for anyone not looking at the screen. */
  hideLabel?: boolean;
}) {
  return (
    <label className="ui-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-check-box">
        <Check size={13} strokeWidth={3} aria-hidden />
      </span>
      <span style={{ flex: 1, minWidth: 0 }} className={hideLabel ? "fk-visually-hidden" : undefined}>
        <span style={{ display: "block", fontSize: 14.5, lineHeight: 1.45 }}>{label}</span>
        {description && (
          <span
            style={{
              display: "block",
              marginTop: 3,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--color-text-tertiary)",
            }}
          >
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="ui-switch"
      data-on={checked}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div
      className="ui-progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          background: color ?? "var(--blue-400)",
        }}
      />
    </div>
  );
}

/* ---------- select ---------- */

export type SelectOption = { value: string; label: string; note?: string };

/**
 * The app's own dropdown, never the operating system's.
 *
 * It measures on open and flips above — or right-aligns — when the menu would
 * leave the viewport, re-measuring on scroll and resize. Do not hardcode
 * `top: 100%` back into the menu.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = "Select…",
  ariaLabel,
}: {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const id = useId();

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const el = root.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const needed = Math.min(280, options.length * 42 + 12);
      const below = window.innerHeight - r.bottom;
      setPlacement(below < needed && r.top > needed ? "above" : "below");
    };
    place();

    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options.length]);

  const selected = options.find((o) => o.value === value) ?? null;
  const wide = options.some((o) => o.note);

  return (
    <div className="ui-select" ref={root}>
      <button
        type="button"
        className="ui-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: selected ? undefined : "var(--color-text-placeholder)",
          }}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          aria-hidden
          style={{
            flex: "0 0 auto",
            color: "var(--neutral-500)",
            transition: "transform .2s ease",
            transform: open ? "rotate(180deg)" : undefined,
          }}
        />
      </button>

      {open && (
        <div
          id={id}
          role="listbox"
          aria-label={ariaLabel}
          className="ui-select-menu"
          style={{
            top: placement === "below" ? "calc(100% + 6px)" : undefined,
            bottom: placement === "above" ? "calc(100% + 6px)" : undefined,
            // A note beside the label needs room, or the label clips.
            minWidth: wide ? 300 : undefined,
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className="ui-select-option"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block" }}>{o.label}</span>
                {o.note && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 2,
                      fontSize: 12.5,
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    {o.note}
                  </span>
                )}
              </span>
              {o.value === value && <Check size={15} strokeWidth={2} aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- surfaces ---------- */

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error" | "info" | "draft";
}) {
  const tones: Record<string, { bg: string; ink: string }> = {
    neutral: { bg: "var(--neutral-100)", ink: "var(--neutral-700)" },
    success: { bg: "var(--green-100)", ink: "var(--green-600)" },
    warning: { bg: "var(--yellow-100)", ink: "var(--yellow-600)" },
    error: { bg: "var(--red-100)", ink: "var(--red-600)" },
    info: { bg: "var(--blue-100)", ink: "var(--blue-700)" },
    draft: { bg: "var(--neutral-150)", ink: "var(--neutral-600)" },
  };
  const t = tones[tone] ?? tones.neutral!;
  return (
    <span className="ui-badge" style={{ background: t.bg, color: t.ink }}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}

export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="ui-pilltabs fk-no-scrollbar" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          className="ui-pilltab"
          onClick={() => onChange(t.value)}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- overlays ---------- */

/**
 * Every overlay renders at the end of <body>. Rendered where it is declared, a
 * fixed overlay is trapped in whatever stacking context its ancestors make,
 * and the sticky dock paints over it however high its own z-index is.
 */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export function Modal({
  title,
  description,
  onClose,
  footer,
  children,
  width,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Portal>
    <div
      className="ui-scrim"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ui-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={width ? { width: `min(${width}px, 100%)` } : undefined}
      >
        <div className="ui-modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-.02em",
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                style={{
                  margin: "7px 0 0",
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: "var(--color-text-secondary)",
                  textWrap: "pretty",
                }}
              >
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} strokeWidth={1.8} aria-hidden />
          </IconButton>
        </div>
        {children != null && <div className="ui-modal-body">{children}</div>}
        {footer && <div className="ui-modal-foot">{footer}</div>}
      </div>
    </div>
    </Portal>
  );
}

export function Drawer({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Portal>
    <div
      className="ui-scrim"
      style={{ padding: 0, justifyContent: "flex-end" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="ui-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "20px 22px",
            boxShadow: "inset 0 -1px 0 var(--neutral-200)",
          }}
        >
          <h2
            style={{
              flex: 1,
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-.02em",
            }}
          >
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} strokeWidth={1.8} aria-hidden />
          </IconButton>
        </div>
        {/* The panel clips to its own shape, so scrolling items cannot run past
            the rounded corners. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 22px" }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "16px 22px",
              boxShadow: "inset 0 1px 0 var(--neutral-200)",
            }}
          >
            {footer}
          </div>
        )}
      </aside>
    </div>
    </Portal>
  );
}
