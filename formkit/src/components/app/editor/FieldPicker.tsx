"use client";

import { useEffect, useRef, useState } from "react";
import { CirclePlus } from "lucide-react";
import { Portal } from "@/components/ui";
import { FIELD_GROUPS, matchFieldTypes } from "./fieldTypes";
import { FieldIcon } from "./FieldIcon";

/**
 * "What do you want to ask?" — the field picker an insert point and the Add
 * question button open. Typing narrows the list; Enter takes the first match.
 */
export function FieldPicker({
  onPick,
  onClose,
}: {
  onPick: (type: string) => void;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  const matches = matchFieldTypes(term);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Portal>
      <div
        className="fk-picker-scrim"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="fk-picker"
          role="dialog"
          aria-modal="true"
          aria-label="Add a question"
        >
          <div className="fk-picker-head">
            <CirclePlus size={18} strokeWidth={1.8} aria-hidden />
            <input
              ref={input}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) onPick(matches[0].type);
              }}
              placeholder="What do you want to ask?"
              aria-label="Search field types"
            />
            <span className="fk-kbd">ESC</span>
          </div>
          <div className="fk-picker-body">
            {matches.length === 0 && (
              <p className="fk-library-lede" style={{ padding: "4px 12px" }}>
                Nothing matches “{term}”.
              </p>
            )}
            {FIELD_GROUPS.map((group) => {
              const items = matches.filter((t) => t.group === group);
              if (!items.length) return null;
              return (
                <div key={group} style={{ marginBottom: 16 }}>
                  <div className="fk-library-group">{group}</div>
                  <div className="fk-picker-grid">
                    {items.map((t) => (
                      <button
                        key={t.type}
                        type="button"
                        className="fk-fieldtile"
                        style={{ cursor: "pointer" }}
                        onClick={() => onPick(t.type)}
                      >
                        <span className="fk-fieldtile-mark">
                          <FieldIcon name={t.icon} />
                        </span>
                        <span className="fk-fieldtile-label">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Portal>
  );
}
