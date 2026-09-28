"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Check, CreditCard } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { buttonInk, themeOf } from "@/components/app/editor/themes";
import { Shell } from "./FormRunner";

type Result = {
  status: "paid" | "pending" | "failed" | "none";
  amount: number;
  currency: string;
  formTitle: string;
  formUrl: string | null;
} | null;

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/**
 * Back from Stripe. The page asks the server, which asks Stripe, whether the
 * payment went through - the address alone proves nothing.
 */
export function PayDone({
  responseId,
  sessionId,
  cancelled,
}: {
  responseId: string | null;
  sessionId: string | null;
  cancelled: boolean;
}) {
  const confirm = useAction(api.payments.confirm);
  const checkout = useAction(api.payments.checkout);
  const [result, setResult] = useState<Result | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const asked = useRef(false);
  const theme = themeOf(null);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    if (!responseId) return;
    confirm({ responseId: responseId as Id<"responses">, sessionId: sessionId ?? undefined })
      .then(setResult)
      .catch(() => setResult(null));
  }, [confirm, responseId, sessionId]);

  /** Kept by the form when it sent the person here, so they can try again. */
  function saved(): { responseId: Id<"responses">; resumeToken: string } | null {
    try {
      const raw = window.sessionStorage.getItem("fk.pay");
      const v = raw ? (JSON.parse(raw) as { responseId: Id<"responses">; resumeToken: string }) : null;
      return v && v.responseId === responseId ? v : null;
    } catch {
      return null;
    }
  }

  async function again() {
    const s = saved();
    if (!s) return;
    setBusy(true);
    setProblem(null);
    try {
      const next = await checkout(s);
      if (next && "url" in next) window.location.assign(next.url);
      else setBusy(false);
    } catch (e) {
      const data = (e as { data?: unknown }).data;
      setProblem(typeof data === "string" ? data : "The payment page did not open. Try again in a moment.");
      setBusy(false);
    }
  }

  const button: React.CSSProperties = {
    height: 52,
    padding: "0 28px",
    border: "none",
    borderRadius: Math.min(theme.radius, 999),
    background: theme.primary,
    color: buttonInk(theme.primary),
    font: "inherit",
    fontWeight: 500,
    cursor: "pointer",
  };

  if (result === undefined && responseId) {
    return (
      <Shell theme={theme}>
        <div style={{ textAlign: "center", paddingTop: "10vh" }}>
          <p className="fk-live-lede">Checking your payment…</p>
        </div>
      </Shell>
    );
  }

  if (!result) {
    return (
      <Shell theme={theme}>
        <div style={{ textAlign: "center", paddingTop: "8vh" }}>
          <h1>That payment link is not here</h1>
          <p className="fk-live-lede">If you paid, you will have a receipt from Stripe by email.</p>
        </div>
      </Shell>
    );
  }

  const paid = result.status === "paid";
  const canRetry = !paid && result.status !== "none" && typeof window !== "undefined" && !!saved();

  return (
    <Shell theme={theme}>
      <div style={{ textAlign: "center", paddingTop: "8vh" }}>
        <span
          className="fk-live-lock"
          style={paid ? { background: theme.primary, color: buttonInk(theme.primary) } : undefined}
        >
          {paid ? <Check size={30} strokeWidth={2} aria-hidden /> : <CreditCard size={30} strokeWidth={1.8} aria-hidden />}
        </span>
        <h1 style={{ marginTop: 22 }}>
          {paid ? "Payment received" : cancelled ? "Payment not finished" : "Payment not confirmed yet"}
        </h1>
        <p className="fk-live-lede">
          {paid
            ? `Thank you. ${money(result.amount, result.currency)} for ${result.formTitle}. Stripe will email your receipt.`
            : `Your answers to ${result.formTitle} are saved, but the ${money(result.amount, result.currency)} payment has not gone through.`}
        </p>
        {problem && <p className="fk-live-err">{problem}</p>}
        {canRetry && (
          <div className="fk-live-foot" style={{ justifyContent: "center" }}>
            <button type="button" style={button} disabled={busy} onClick={() => void again()}>
              {busy ? "Opening…" : "Pay now"}
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
