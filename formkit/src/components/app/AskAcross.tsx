"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { Sparkles } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button, Input } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, useGate } from "@/components/plan/usePlan";
import { errorText } from "./settings/bits";

type Answer = { headline: string; points: { title: string; detail: string }[]; byForm: { form: string; note: string }[]; read: number };

/**
 * Pro, on Analytics across all forms: one question asked of several forms
 * at once, answered from the AI's notes on each response. Uses one
 * insights report.
 */
export function AskAcross({ forms }: { forms: { _id: Id<"forms">; title: string }[] }) {
  const toast = useToast();
  const gate = useGate("ai.insights");
  const ask = useAction(api.insights.across);
  const [picked, setPicked] = useState<Set<string>>(new Set(forms.slice(0, 6).map((f) => f._id)));
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  if (forms.length < 2) return null;

  return (
    <section className="fk-panel" style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={{ margin: 0, flex: 1 }}>Ask across your forms</h3>
        {gate.locked && <ProChip onClick={() => openUpgrade({ feature: "ai.insights" })} />}
      </div>
      <p className="fk-panel-lede">
        One question about what people said, answered from the AI’s notes on every response to the forms you pick. Uses one
        insights report.
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0 12px" }}>
        {forms.slice(0, 40).map((f) => (
          <button
            key={f._id}
            type="button"
            className="fk-filter"
            aria-pressed={picked.has(f._id)}
            onClick={() =>
              setPicked((p) => {
                const next = new Set(p);
                if (next.has(f._id)) next.delete(f._id);
                else if (next.size < 20) next.add(f._id);
                return next;
              })
            }
          >
            {f.title}
          </button>
        ))}
      </div>
      <form
        style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
        onSubmit={gate.guard(async (e: React.FormEvent) => {
          e.preventDefault();
          setBusy(true);
          try {
            setAnswer(await ask({ formIds: [...picked] as Id<"forms">[], question }));
          } catch (err) {
            toast(errorText(err, "That could not be answered."));
          } finally {
            setBusy(false);
          }
        })}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What do people complain about most?"
          aria-label="Your question"
          wrapStyle={{ flex: 1, minWidth: 240 }}
        />
        <Button type="submit" disabled={busy || picked.size === 0 || question.trim().length < 4} iconLeft={<Sparkles size={16} strokeWidth={1.8} aria-hidden />}>
          {busy ? "Reading…" : "Ask"}
        </Button>
      </form>
      {answer && (
        <div style={{ marginTop: 18 }}>
          <p className="fk-summary-big" style={{ marginTop: 0 }}>
            {answer.headline}
          </p>
          <ul className="fk-summary-latest">
            {answer.points.map((p, i) => (
              <li key={i}>
                <strong style={{ fontWeight: 500 }}>{p.title}.</strong> {p.detail}
              </li>
            ))}
          </ul>
          {answer.byForm.length > 0 && (
            <>
              <div className="fk-resp-group-title" style={{ marginTop: 14 }}>
                Where forms differ
              </div>
              <ul className="fk-summary-latest">
                {answer.byForm.map((f, i) => (
                  <li key={i}>
                    <strong style={{ fontWeight: 500 }}>{f.form}:</strong> {f.note}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="fk-quiet" style={{ marginTop: 10, fontSize: 12.5 }}>
            From the AI’s notes on {answer.read.toLocaleString("en-US")} responses.
          </p>
        </div>
      )}
    </section>
  );
}
