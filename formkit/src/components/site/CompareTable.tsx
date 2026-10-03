"use client";

import { useState } from "react";
import { Check, Minus, X } from "lucide-react";
import { COMPARE_ROWS, COLUMNS, type Cell, type Rival } from "@/content/compare";
import { Logo } from "@/components/brand/Logo";

/** Each product by its own logo; the name stays for screen readers. */
function ProductLogo({ name, height = 22 }: { name: string; height?: number }) {
  if (name === "Formkit") return <Logo size={height} />;
  // Only the two on the hub table have a wordmark; the rest go by name.
  if (name !== "Google Forms" && name !== "Typeform") {
    return <span style={{ fontSize: Math.round(height * 0.78), fontWeight: 600, letterSpacing: "-.01em" }}>{name}</span>;
  }
  const src = name === "Google Forms" ? "/brands/google-forms.svg" : "/brands/typeform-ink.svg";
  // Typeform's letters fill their box; Google's leave room. Evened out by eye.
  const h = Math.round(name === "Typeform" ? height * 0.8 : height);
  // Both wordmarks are about six times wider than tall.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} height={h} width={Math.round(h * 6.2)} style={{ display: "block", height: h, width: "auto" }} />;
}

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

type Matrix = { names: string[]; rows: { label: string; cells: Cell[] }[] };

/** The hub's columns, or one rival's own rows set against Formkit. */
function matrixOf(columns?: (0 | 1 | 2)[], rival?: Rival): Matrix {
  if (rival?.rows) {
    return {
      names: [rival.name, "Formkit"],
      rows: rival.rows.map((r) => ({ label: r.label, cells: [r.them, r.us] })),
    };
  }
  const shown = columns ?? (rival?.column !== undefined ? [rival.column, 2] : [0, 1, 2]);
  return {
    names: shown.map((i) => COLUMNS[i]),
    rows: COMPARE_ROWS.map((r) => ({ label: r.label, cells: shown.map((i) => r.cells[i]) })),
  };
}

export function CompareTable({ columns, rival }: { columns?: (0 | 1 | 2)[]; rival?: Rival }) {
  const { names, rows } = matrixOf(columns, rival);

  return (
    <>
      <div className="fk-scroll-x fk-cmp-table">
      <table
        className="fk-cmp-t"
        style={{
          width: "100%",
          minWidth: names.length > 2 ? 760 : 560,
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
            {names.map((name) => (
              <th
                key={name}
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
                  background: name === "Formkit" ? "var(--blue-50)" : undefined,
                }}
              >
                <ProductLogo name={name} />
                <Tally cells={rows.map((r) => r.cells[names.indexOf(name)]!)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
              {names.map((name, i) => (
                <td
                  key={name}
                  style={{
                    padding: "14px clamp(16px,2vw,26px)",
                    borderBottom: "1px solid var(--neutral-200)",
                    verticalAlign: "middle",
                    background: name === "Formkit" ? "var(--blue-50)" : undefined,
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
      <CompareList names={names} rows={rows} />
    </>
  );
}

/** How a column adds up: a small stacked bar and the counts in words. */
function Tally({ cells }: { cells: Cell[] }) {
  const count = (k: Cell["kind"]) => cells.filter((c) => c.kind === k).length;
  const parts = (["yes", "part", "no"] as const).map((k) => ({ k, n: count(k) })).filter((x) => x.n > 0);
  return (
    <span className="fk-cmp-tally">
      <span className="fk-cmp-tally-bar" aria-hidden>
        {parts.map((x) => (
          <i key={x.k} data-kind={x.k} style={{ flexGrow: x.n }} />
        ))}
      </span>
      <small>{parts.map((x) => `${x.n} ${TONES[x.k].label.toLowerCase()}`).join(" · ")}</small>
    </span>
  );
}

/**
 * The same matrix on a phone, where three columns of notes cannot sit side by
 * side: one product against Formkit at a time, each capability a row.
 */
function CompareList({ names, rows }: Matrix) {
  const rivals = names.map((_, i) => i).filter((i) => names[i] !== "Formkit");
  const formkit = names.indexOf("Formkit");
  const [rival, setRival] = useState(rivals[0]);

  return (
    <div className="fk-cmp-list">
      {rivals.length > 1 && (
        <div className="fk-cmp-pick" role="radiogroup" aria-label="Compare Formkit with">
          {rivals.map((i) => (
            <button
              key={names[i]}
              type="button"
              role="radio"
              aria-checked={rival === i}
              onClick={() => setRival(i)}
            >
              <ProductLogo name={names[i]} height={16} />
            </button>
          ))}
        </div>
      )}
      <div className="fk-cmp-cols" aria-hidden>
        <span />
        {rival !== undefined && (
          <span>
            <ProductLogo name={names[rival]} height={15} />
          </span>
        )}
        {formkit >= 0 && (
          <span data-us>
            <ProductLogo name="Formkit" height={15} />
          </span>
        )}
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row.label}>
            <span className="fk-cmp-label">{row.label}</span>
            <span className="fk-cmp-cells">
              {rival !== undefined && (
                <span>
                  <span className="sr-only">{names[rival]}: </span>
                  <Mark cell={row.cells[rival]} />
                </span>
              )}
              {formkit >= 0 && (
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
