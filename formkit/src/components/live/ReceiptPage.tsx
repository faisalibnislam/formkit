"use client";

import { useQuery } from "convex/react";
import { Printer } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { themeOf } from "@/components/app/editor/themes";
import { Shell } from "./FormRunner";

/**
 * A respondent's receipt: what they sent, when, and a reference, in the
 * form's own look. Print it, or save it as a PDF from the print dialog;
 * the page prints as plain paper.
 */
export function ReceiptPage({ token }: { token: string }) {
  const r = useQuery(api.publicForm.receipt, { token });
  if (r === undefined) return null;
  if (r === null) {
    return (
      <div className="fk-live">
        <div className="fk-live-inner">
          <h1>No receipt here</h1>
          <p className="fk-live-lede">That link does not lead to a receipt. Check it against the one in your email.</p>
        </div>
      </div>
    );
  }
  const when = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date(r.submittedAt));
  return (
    <Shell theme={themeOf(r.theme)} brand={r.brand} logos={r.logos}>
      <div className="fk-receipt">
        <p className="fk-receipt-eyebrow">Receipt</p>
        <h1 style={{ margin: "4px 0 6px" }}>{r.title}</h1>
        <p className="fk-live-lede" style={{ margin: 0 }}>
          Sent {when} · Reference {r.reference}
        </p>
        <dl className="fk-receipt-answers">
          {r.answers.map((a, i) => (
            <div key={i}>
              <dt>{a.question}</dt>
              <dd>{a.answer}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="fk-receipt-print" onClick={() => window.print()}>
          <Printer size={16} strokeWidth={1.8} aria-hidden />
          Print or save as PDF
        </button>
      </div>
    </Shell>
  );
}
