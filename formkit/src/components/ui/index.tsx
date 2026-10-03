"use client";

import {
  Fragment,
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Pipette, X } from "lucide-react";

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
  tip,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "danger";
  /** Show the label as a dark tip above the button, instead of the browser's own. */
  tip?: boolean;
}) {
  // Every icon-only control takes a required label.
  return (
    <button
      type="button"
      {...rest}
      className={`ui-iconbtn ${rest.className ?? ""}`}
      data-tone={tone}
      data-tip={tip ? label : undefined}
      aria-label={label}
      title={tip ? undefined : label}
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
  /** Sits after the field - a unit, or the shortcut that opens it. */
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

export type SelectOption = {
  value: string;
  label: string;
  note?: string;
  /** Options sharing a group sit under its heading, in the order given. */
  group?: string;
  /** A small mark before the label: a logo, an avatar. */
  icon?: ReactNode;
};

/** The widest a dropdown menu grows to fit its options, unless its trigger is wider. */
const MENU_MAX = 380;

/**
 * The app's own dropdown, never the operating system's.
 *
 * It measures on open and flips above - or right-aligns - when the menu would
 * leave the viewport, re-measuring on scroll and resize. Do not hardcode
 * `top: 100%` back into the menu.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = "Select…",
  ariaLabel,
  size = "md",
  searchable,
  searchPlaceholder = "Search",
  optionStyle,
  onOpen,
}: {
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  size?: "sm" | "md";
  /** A filter box at the top of the menu, for long lists. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Per-option styling - a font list shows each name in its own face. */
  optionStyle?: (o: SelectOption) => CSSProperties | undefined;
  onOpen?: () => void;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"below" | "above">("below");
  const [alignRight, setAlignRight] = useState(false);
  const [rect, setRect] = useState<{ top: number; bottom: number; left: number; right: number; width: number } | null>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(-1);
  const id = useId();

  const q = query.trim().toLowerCase();
  const shown = q
    ? options.filter((o) => `${o.label} ${o.note ?? ""}`.toLowerCase().includes(q))
    : options;
  const wide = options.some((o) => o.note);
  // The menu sizes to its longest option (up to a cap); placing it estimates that.
  const longest = Math.max(0, ...options.map((o) => o.label.length));

  useEffect(() => {
    if (!open) return;

    const place = () => {
      const el = root.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const needed = Math.min(searchable ? 340 : 280, options.length * 42 + (searchable ? 60 : 12));
      const below = window.innerHeight - r.bottom;
      setPlacement(below < needed && r.top > needed ? "above" : "below");
      const menuWidth = Math.min(MENU_MAX, Math.max(r.width, wide ? 300 : 0, searchable ? 260 : 0, longest * 8 + 64));
      setAlignRight(r.left + menuWidth > window.innerWidth - 8);
      setRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width });
    };
    place();

    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (root.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, options.length, searchable, wide, longest]);

  useEffect(() => {
    if (open && searchable) search.current?.focus();
  }, [open, searchable]);

  const selected = options.find((o) => o.value === value) ?? null;

  const toggle = (next: boolean) => {
    setOpen(next);
    setQuery("");
    setCursor(next ? Math.max(0, options.findIndex((o) => o.value === value)) : -1);
    if (next) onOpen?.();
  };
  const pick = (o: SelectOption) => {
    onChange(o.value);
    toggle(false);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape" && open) {
      // Close this, not the dialog it sits in.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      toggle(false);
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      toggle(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(shown.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter" && shown[cursor]) {
      e.preventDefault();
      pick(shown[cursor]!);
    }
  };

  return (
    <div className="ui-select" ref={root} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="ui-select-trigger"
        data-size={size}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => toggle(!open)}
      >
        {selected?.icon && <span className="ui-select-icon">{selected.icon}</span>}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: selected ? undefined : "var(--color-text-placeholder)",
            ...(selected ? optionStyle?.(selected) : undefined),
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

      {open && rect && (
        /* In a portal, placed from the trigger's own box: a menu that stays
           in the page is trapped under whatever stacking context it is in -
           the dock paints over one that opens upward beneath it. */
        <Portal>
        <div
          ref={menu}
          className="ui-select-menu"
          data-searchable={searchable ? "true" : undefined}
          style={{
            position: "fixed",
            top: placement === "below" ? rect.bottom + 6 : undefined,
            bottom: placement === "above" ? window.innerHeight - rect.top + 6 : undefined,
            left: alignRight ? undefined : rect.left,
            right: alignRight ? window.innerWidth - rect.right : undefined,
            // As wide as its longest option, never narrower than the trigger:
            // a short trigger ("All forms") must not squeeze long names into
            // three lines each. A note beside the label needs room too.
            minWidth: Math.min(Math.max(rect.width, wide ? 300 : 0, searchable ? 260 : 0), window.innerWidth - 16),
            maxWidth: `min(${Math.max(MENU_MAX, rect.width)}px, calc(100vw - 16px))`,
          }}
        >
          {searchable && (
            <div className="ui-select-search">
              <input
                ref={search}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                placeholder={searchPlaceholder}
                aria-label="Filter options"
              />
            </div>
          )}
          <div id={id} role="listbox" aria-label={ariaLabel} className="ui-select-list">
            {shown.length === 0 && <div className="ui-select-empty">Nothing matches “{query}”.</div>}
            {shown.map((o, k) => (
              <Fragment key={o.value}>
              {o.group && o.group !== shown[k - 1]?.group && (
                <div className="ui-select-group" role="presentation">
                  {o.group}
                </div>
              )}
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                data-active={k === cursor ? "true" : undefined}
                className="ui-select-option"
                onMouseEnter={() => setCursor(k)}
                onClick={() => pick(o)}
              >
                {o.icon && <span className="ui-select-icon">{o.icon}</span>}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="ui-select-label" title={o.label} style={optionStyle?.(o)}>
                    {o.label}
                  </span>
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
                {o.value === value && <Check size={15} strokeWidth={2} aria-hidden style={{ flex: "0 0 auto" }} />}
              </button>
              </Fragment>
            ))}
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}

/* ---------- colour ---------- */

const HEX = /^[0-9a-fA-F]{6}$/;

function isLight(hex: string) {
  const h = hex.replace("#", "");
  if (!HEX.test(h)) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/**
 * A colour: a row of swatches, the system picker behind an eyedropper, and a
 * hex field that only commits six valid digits - anything else says so in
 * red and changes nothing.
 */
export function ColorField({
  value,
  onChange,
  presets,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  presets: string[];
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clean = (v: string) => v.replace("#", "").trim().slice(0, 6);
  const shown = draft ?? clean(value);
  const invalid = draft !== null && draft.length > 0 && !HEX.test(draft);
  const commit = (hex: string) => {
    const c = clean(hex);
    if (HEX.test(c)) onChange(`#${c.toLowerCase()}`);
  };

  return (
    <div className="ui-color">
      <div className="ui-color-swatches">
        {presets.map((hex) => (
          <button
            key={hex}
            type="button"
            className="ui-color-swatch"
            title={hex}
            aria-label={`${label} ${hex}`}
            aria-pressed={hex.toLowerCase() === value.toLowerCase()}
            style={{ background: hex }}
            onClick={() => {
              setDraft(null);
              commit(hex);
            }}
          />
        ))}
      </div>
      <div className="ui-color-row">
        <label className="ui-color-native" style={{ background: value }} title="Pick any colour">
          <input
            type="color"
            value={HEX.test(clean(value)) ? `#${clean(value)}` : "#000000"}
            aria-label={`${label}: pick any colour`}
            onChange={(e) => {
              setDraft(null);
              commit(e.target.value);
            }}
          />
          <Pipette
            size={16}
            strokeWidth={1.8}
            aria-hidden
            style={{ color: isLight(value) ? "var(--neutral-900)" : "var(--neutral-0)", opacity: 0.8 }}
          />
        </label>
        <span className="ui-color-hex" data-invalid={invalid ? "true" : undefined}>
          <span style={{ color: "var(--color-text-tertiary)" }}>#</span>
          <input
            value={shown}
            spellCheck={false}
            maxLength={7}
            aria-label={`${label} hex code`}
            aria-invalid={invalid}
            onChange={(e) => {
              const v = clean(e.target.value);
              setDraft(v);
              if (HEX.test(v)) commit(v);
            }}
            onBlur={() => setDraft(null)}
          />
          {invalid && <span className="ui-color-err">6 digits</span>}
        </span>
      </div>
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

/** A small set of mutually exclusive choices; an option may be an icon alone. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
}: {
  options: { value: T; label?: string; icon?: ReactNode; title?: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="ui-pilltabs fk-no-scrollbar" role="radiogroup" aria-label={ariaLabel} data-size={size}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.label ? undefined : (o.title ?? o.value)}
          title={o.title}
          className="ui-pilltab"
          data-icon-only={o.label ? undefined : "true"}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
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
const noSubscription = () => () => {};

/**
 * Renders into <body>. The server has no <body> to portal into, so while the
 * page hydrates this renders nothing, as the server did, and the portal
 * appears straight after; mounted any later (a click), it appears at once.
 */
export function Portal({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);
  return ready ? createPortal(children, document.body) : null;
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
