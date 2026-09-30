import Link from "next/link";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import { keyDifference, type Cell, type Rival } from "@/content/compare";

/**
 * One comparison, as a card: the other product by its initials (no logos or
 * brand colours), what it is good at, and the first row where the two differ.
 */

const ICON = { yes: Check, part: Minus, no: X } as const;

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
}

function Side({ name, cell, ours }: { name: string; cell: Cell; ours?: boolean }) {
  const Icon = ICON[cell.kind];
  return (
    <span className="fk-rc-side" data-kind={cell.kind} data-ours={ours || undefined}>
      <small>{name}</small>
      <span>
        <i aria-hidden>
          <Icon size={11} strokeWidth={2.8} />
        </i>
        {cell.note}
      </span>
    </span>
  );
}

export function RivalCard({ r }: { r: Rival }) {
  const diff = keyDifference(r);
  return (
    <Link href={`/compare/${r.slug}`} className="fk-rc">
      <span className="fk-rc-head">
        <span className="fk-rc-mono" aria-hidden>
          {initials(r.name)}
        </span>
        <span className="fk-rc-vs">
          <small>Formkit vs</small>
          <b>{r.name}</b>
        </span>
      </span>
      <span className="fk-rc-line">{r.line}</span>
      {diff && (
        <span className="fk-rc-diff">
          <span className="fk-rc-label">{diff.label}</span>
          <Side name={r.name} cell={diff.them} />
          <Side name="Formkit" cell={diff.us} ours />
        </span>
      )}
      <span className="fk-rc-go">
        Read the comparison <ArrowRight size={15} strokeWidth={2} aria-hidden />
      </span>
    </Link>
  );
}
