"use client";

import type React from "react";
import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/**
 * Text that is typed here and saved to Convex.
 *
 * Binding an input straight to a query result drops keystrokes: React puts the
 * old value back on every change, and the new one only arrives after the round
 * trip. These hold what was typed locally, commit it after a pause and on blur,
 * and take the server's value again only while nobody is typing in them.
 */
const PAUSE = 450;

function useDraft(value: string, commit: (next: string) => void) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const timer = useRef<number | null>(null);
  const last = useRef(value);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  useEffect(() => {
    if (!focused.current && timer.current === null) {
      setDraft(value);
      last.current = value;
    }
  }, [value]);

  const flush = (next: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    if (next !== last.current) {
      last.current = next;
      commitRef.current(next);
    }
  };

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return {
    value: draft,
    onChange: (next: string) => {
      setDraft(next);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(next), PAUSE);
    },
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      flush(draft);
    },
  };
}

type Common = { value: string; onCommit: (next: string) => void };

export function DraftInput({
  value,
  onCommit,
  ...rest
}: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const d = useDraft(value, onCommit);
  return (
    <input
      {...rest}
      value={d.value}
      onChange={(e) => d.onChange(e.target.value)}
      onFocus={(e) => {
        d.onFocus();
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        d.onBlur();
        rest.onBlur?.(e);
      }}
    />
  );
}

export function DraftTextarea({
  value,
  onCommit,
  ...rest
}: Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  const d = useDraft(value, onCommit);
  return (
    <textarea
      {...rest}
      value={d.value}
      onChange={(e) => d.onChange(e.target.value)}
      onFocus={(e) => {
        d.onFocus();
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        d.onBlur();
        rest.onBlur?.(e);
      }}
    />
  );
}

/** A `DraftInput` in the design system's pill. */
export function DraftPill({
  size = "sm",
  icon,
  wrapStyle,
  ...rest
}: Common &
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "size"> & {
    size?: "sm" | "md";
    icon?: React.ReactNode;
    wrapStyle?: React.CSSProperties;
  }) {
  return (
    <span className="ui-input-wrap" data-size={size} style={wrapStyle}>
      {icon}
      <DraftInput {...rest} />
    </span>
  );
}

/** A `DraftTextarea` in the design system's field. */
export function DraftArea(
  props: Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">,
) {
  return <DraftTextarea {...props} className={`ui-textarea ${props.className ?? ""}`} />;
}
