"use client";

import { Fragment, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * A comment box that knows who is on the form. Typing @ offers them; picking
 * one writes "@Name" into the text. Whoever is still named that way when the
 * comment is sent is mentioned — so deleting the name un-mentions them, and
 * typing a name out in full works as well as picking it.
 */

export type Person = { _id: string; name: string; email: string; color: string };

/** The @word being typed at the caret, if any. */
function tokenAt(text: string, caret: number) {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(before);
  return m ? { start: caret - m[2]!.length - 1, query: m[2]!.toLowerCase() } : null;
}

export function mentionsIn(text: string, people: Person[]) {
  const lower = text.toLowerCase();
  return people.filter((p) => lower.includes(`@${p.name.toLowerCase()}`)).map((p) => p._id);
}

/** A comment's text with its mentions picked out. */
export function withMentions(body: string, names: string[]): ReactNode {
  const list = [...new Set(names)].filter(Boolean).sort((a, b) => b.length - a.length);
  if (!list.length) return body;
  const escaped = list.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = body.split(new RegExp(`(@(?:${escaped.join("|")}))`, "gi"));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="fk-mention">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function MentionField({
  value,
  onChange,
  people,
  multiline,
  placeholder,
  label,
  onSubmitShortcut,
}: {
  value: string;
  onChange: (next: string) => void;
  people: Person[];
  multiline?: boolean;
  placeholder: string;
  label: string;
  onSubmitShortcut?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [token, setToken] = useState<{ start: number; query: string } | null>(null);
  const [cursor, setCursor] = useState(0);

  const matches = token
    ? people
        .filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(token.query))
        .slice(0, 6)
    : [];
  const open = matches.length > 0;

  function read(el: HTMLTextAreaElement | HTMLInputElement) {
    setToken(tokenAt(el.value, el.selectionStart ?? el.value.length));
    setCursor(0);
  }

  function pick(p: Person) {
    const el = ref.current;
    if (!el || !token) return;
    const caret = el.selectionStart ?? value.length;
    const next = `${value.slice(0, token.start)}@${p.name} ${value.slice(caret)}`;
    onChange(next);
    setToken(null);
    const at = token.start + p.name.length + 2;
    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at, at);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => (c + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(matches[cursor]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setToken(null);
        return;
      }
    }
    if (e.key === "Enter" && (multiline ? e.metaKey || e.ctrlKey : true) && onSubmitShortcut) {
      e.preventDefault();
      onSubmitShortcut();
    }
  }

  const common = {
    ref,
    value,
    placeholder,
    "aria-label": label,
    "aria-autocomplete": "list" as const,
    "aria-expanded": open,
    onChange: (e: { target: HTMLTextAreaElement | HTMLInputElement }) => {
      onChange(e.target.value);
      read(e.target);
    },
    onKeyUp: (e: { currentTarget: HTMLTextAreaElement | HTMLInputElement; key: string }) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") read(e.currentTarget);
    },
    onClick: (e: { currentTarget: HTMLTextAreaElement | HTMLInputElement }) => read(e.currentTarget),
    onBlur: () => window.setTimeout(() => setToken(null), 120),
    onKeyDown,
  };

  return (
    <div className="fk-mentionfield">
      {multiline ? (
        <textarea className="ui-textarea" rows={3} {...common} />
      ) : (
        <span className="ui-input-wrap" data-size="sm">
          <input {...common} />
        </span>
      )}
      {open && (
        <div className="fk-mention-menu" role="listbox" aria-label="People on this form">
          {matches.map((p, i) => (
            <button
              key={p._id}
              type="button"
              role="option"
              aria-selected={i === cursor}
              className="fk-mention-option"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(p)}
            >
              <span className="fk-mention-avatar" style={{ background: p.color }} aria-hidden>
                {p.name
                  .split(/\s+/)
                  .map((w) => w[0] ?? "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="fk-mention-name">{p.name}</span>
                <span className="fk-mention-mail">{p.email}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
