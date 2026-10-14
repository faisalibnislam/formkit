"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useRef } from "react";
import { cell } from "../../../convex/model/grid";

/**
 * Matrix and ranking questions on a live form.
 *
 * A matrix is a table: each row a radio group (or checkboxes, with several
 * per row), so a keyboard and a screen reader move through it the way they
 * move through any other choice. A ranking is a list to put in order by
 * dragging, or with the up and down buttons; nothing counts as answered
 * until the person has moved something or said the order is right.
 */

type Props = {
  rows: string[];
  columns: string[];
  multi: boolean;
  values: string[];
  radius: number;
  label: string;
  group: Record<string, unknown>;
  onChange: (values: string[]) => void;
};

export function MatrixControl({ rows, columns, multi, values, radius, label, group, onChange }: Props) {
  const picked = new Set(values);
  const toggle = (row: string, column: string) => {
    const v = cell(row, column);
    if (multi) onChange(picked.has(v) ? values.filter((x) => x !== v) : [...values, v]);
    else onChange([...values.filter((x) => !x.startsWith(`${row}: `)), v]);
  };
  return (
    <div className="fk-live-matrix" role="group" {...group}>
      <div className="fk-live-matrix-grid" style={{ gridTemplateColumns: `minmax(120px, 1.6fr) repeat(${columns.length}, minmax(52px, 1fr))` }}>
        <span aria-hidden />
        {columns.map((c) => (
          <span key={c} className="fk-live-matrix-head" aria-hidden>
            {c}
          </span>
        ))}
        {rows.map((r) => (
          <div key={r} role={multi ? "group" : "radiogroup"} aria-label={`${label}: ${r}`} style={{ display: "contents" }}>
            <span className="fk-live-matrix-row">{r}</span>
            {columns.map((c, j) => {
              const on = picked.has(cell(r, c));
              const firstInRow = !values.some((x) => x.startsWith(`${r}: `)) && j === 0;
              return (
                <button
                  key={c}
                  type="button"
                  role={multi ? "checkbox" : "radio"}
                  aria-checked={on}
                  aria-label={c}
                  tabIndex={multi || on || firstInRow ? 0 : -1}
                  className="fk-live-matrix-cell"
                  data-picked={on ? "true" : undefined}
                  style={{ borderRadius: Math.min(radius, 999) }}
                  onClick={() => toggle(r, c)}
                  onKeyDown={(e) => {
                    if (multi || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
                    e.preventDefault();
                    const next = columns[(j + (e.key === "ArrowRight" ? 1 : -1) + columns.length) % columns.length]!;
                    toggle(r, next);
                    (e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[columns.indexOf(next)])?.focus();
                  }}
                >
                  <span className="fk-live-matrix-dot" data-square={multi ? "true" : undefined} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RankingControl({
  options,
  values,
  radius,
  label,
  group,
  onChange,
}: {
  options: string[];
  values: string[];
  radius: number;
  label: string;
  group: Record<string, unknown>;
  onChange: (values: string[]) => void;
}) {
  const order = values.length === options.length && values.every((v) => options.includes(v)) ? values : options;
  const answered = order === values;
  const dragging = useRef<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x!);
    onChange(next);
  };
  return (
    <div {...group} role="group">
      <ol className="fk-live-rank" aria-label={`${label}, in order`}>
        {order.map((o, i) => (
          <li
            key={o}
            className="fk-live-rank-item"
            draggable
            style={{ borderRadius: radius }}
            onDragStart={() => (dragging.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging.current !== null) move(dragging.current, i);
              dragging.current = null;
            }}
          >
            <span className="fk-live-rank-n">{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0 }}>{o}</span>
            <button type="button" aria-label={`Move ${o} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
              <ArrowUp size={16} strokeWidth={1.8} aria-hidden />
            </button>
            <button type="button" aria-label={`Move ${o} down`} disabled={i === order.length - 1} onClick={() => move(i, i + 1)}>
              <ArrowDown size={16} strokeWidth={1.8} aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      {!answered && (
        <button type="button" className="fk-live-rank-keep" onClick={() => onChange([...order])}>
          This order is right
        </button>
      )}
    </div>
  );
}
