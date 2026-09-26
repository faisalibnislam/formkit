"use client";

import { useState } from "react";
import { Check, Minus, X } from "lucide-react";
import { COMPARE_ROWS, COLUMNS, type Cell } from "@/content/compare";

/**
 * The comparison matrix.
 *
 * Every cell carries a word as well as a glyph, so the table never relies on
 * colour or icon alone. A dash is amber and means "offered but narrower".
 */
const TONES: Record<Cell["kind"], { bg: string; ink: string; label: string }> = {
  yes: { bg: "var(--green-100)", ink: "var(--green-600)", label: "Yes" },
  part: { bg: "var(--yellow-100)", ink: "var(--yellow-600)", label: "Partly" },
  no: { bg: "var(--red-100)", ink: "var(--red-600)", label: "No" },
};

function Mark({ cell }: { cell: Cell }) {
  const tone = TONES[cell.kind];
  const Icon = cell.kind === "yes" ? Check : cell.kind === "no" ? X : Minus;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          flex: "0 0 auto",
          borderRadius: "50%",
          background: tone.bg,
          color: tone.ink,
        }}
      >
        <Icon size={14} strokeWidth={2.2} aria-hidden />
        <span className="sr-only">{tone.label}</span>
      </span>
      <span style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
        {cell.note}
      </span>
    </span>
  );
}

export function CompareTable({ columns }: { columns?: (0 | 1 | 2)[] }) {
  const shown = columns ?? [0, 1, 2];

  return (
    <>
      <div className="fk-scroll-x fk-cmp-table">
      <table
        style={{
          width: "100%",
          minWidth: shown.length > 2 ? 760 : 560,
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th
              scope="col"
              style={{
                padding: "18px clamp(16px,2vw,26px)",
                textAlign: "left",
                verticalAlign: "top",
                borderBottom: "1px solid var(--neutral-200)",
                fontSize: 13,
                fontWeight: 400,
                color: "var(--color-text-tertiary)",
              }}
            >
              Capability
            </th>
            {shown.map((i) => (
              <th
                key={COLUMNS[i]}
                scope="col"
                style={{
                  padding: "18px clamp(16px,2vw,26px)",
                  textAlign: "left",
                  verticalAlign: "top",
                  borderBottom: "1px solid var(--neutral-200)",
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "-.01em",
                  color: "var(--neutral-900)",
                  background: COLUMNS[i] === "Formkit" ? "var(--blue-50)" : undefined,
                }}
              >
                {COLUMNS[i]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((row) => (
            <tr key={row.label}>
              <th
                scope="row"
                style={{
                  padding: "14px clamp(16px,2vw,26px)",
                  textAlign: "left",
                  borderBottom: "1px solid var(--neutral-200)",
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--neutral-900)",
                }}
              >
                {row.label}
              </th>
              {shown.map((i) => (
                <td
                  key={COLUMNS[i]}
                  style={{
                    padding: "14px clamp(16px,2vw,26px)",
                    borderBottom: "1px solid var(--neutral-200)",
                    verticalAlign: "middle",
                    background: COLUMNS[i] === "Formkit" ? "var(--blue-50)" : undefined,
                  }}
                >
                  <Mark cell={row.cells[i]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <CompareList shown={shown} />
    </>
  );
}

/**
 * The same matrix on a phone, where three columns of notes cannot sit side by
 * side: one product against Formkit at a time, each capability a row.
 */
function CompareList({ shown }: { shown: (0 | 1 | 2)[] }) {
  const rivals = shown.filter((i) => COLUMNS[i] !== "Formkit");
  const formkit = shown.find((i) => COLUMNS[i] === "Formkit");
  const [rival, setRival] = useState(rivals[0]);

  return (
    <div className="fk-cmp-list">
      {rivals.length > 1 && (
        <div className="fk-cmp-pick" role="radiogroup" aria-label="Compare Formkit with">
          {rivals.map((i) => (
            <button
              key={COLUMNS[i]}
              type="button"
              role="radio"
              aria-checked={rival === i}
              onClick={() => setRival(i)}
            >
              {COLUMNS[i]}
            </button>
          ))}
        </div>
      )}
      <div className="fk-cmp-cols" aria-hidden>
        <span />
        {rival !== undefined && <span>{COLUMNS[rival]}</span>}
        {formkit !== undefined && <span data-us>Formkit</span>}
      </div>
      <ul>
        {COMPARE_ROWS.map((row) => (
          <li key={row.label}>
            <span className="fk-cmp-label">{row.label}</span>
            <span className="fk-cmp-cells">
              {rival !== undefined && (
                <span>
                  <span className="sr-only">{COLUMNS[rival]}: </span>
                  <Mark cell={row.cells[rival]} />
                </span>
              )}
              {formkit !== undefined && (
                <span data-us>
                  <span className="sr-only">Formkit: </span>
                  <Mark cell={row.cells[formkit]} />
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
