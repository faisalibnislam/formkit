"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button, EmptyState, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * Ask Formkit.
 *
 * This page exists only for an account on the allow-list; the shell does not
 * link to it otherwise, and the action refuses. There is no locked state here
 * on purpose — an account without access should never learn the feature exists.
 */
const STARTERS = [
  "A short feedback form for a design studio, five questions.",
  "A job application for a junior developer, with a file upload for a CV.",
  "An event sign-up with dietary requirements and accessibility needs.",
  "A weekly check-in for a small team.",
];

export function AskFormkit() {
  const router = useRouter();
  const toast = useToast();
  const viewer = useQuery(api.users.viewer, {});
  const forms = useQuery(api.forms.list, { filter: "all" });
  const ask = useAction(api.ai.ask);

  const [prompt, setPrompt] = useState("");
  const [target, setTarget] = useState("new");
  const [busy, setBusy] = useState(false);

  if (viewer && !viewer.ai.allowed) {
    return (
      <div className="fk-panel">
        <EmptyState
          title="Not found"
          description="There is nothing at this address."
        />
      </div>
    );
  }

  const left = viewer ? Math.max(0, viewer.ai.limit - viewer.ai.used) : 0;

  async function go() {
    setBusy(true);
    try {
      const result = await ask({
        prompt,
        formId: target === "new" ? undefined : (target as never),
      });
      toast(target === "new" ? "Your form is ready" : "The questions are rewritten", {
        detail: `${result.limit - result.used} of ${result.limit} credits left`,
      });
      router.push(`/app/forms/${result.formId}`);
    } catch (e) {
      setBusy(false);
      toast("Ask Formkit could not do that", {
        detail: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  }

  return (
    <>
      <section className="fk-panel">
        <h3>{target === "new" ? "Describe the form you need" : "Ask for a change"}</h3>
        <p className="fk-panel-lede">
          Say it the way you would to a colleague. Formkit writes the questions; everything it
          writes is yours to change afterwards.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Select
            value={target}
            ariaLabel="What to work on"
            onChange={setTarget}
            options={[
              { value: "new", label: "A new form" },
              ...(forms?.forms ?? []).map((f) => ({
                value: f._id,
                label: f.title,
                note: `${f.questions} questions — its questions will be replaced`,
              })),
            ]}
          />

          <Textarea
            rows={4}
            value={prompt}
            aria-label="What the form is for"
            placeholder="A short feedback form for a design studio, five questions."
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="fk-chiprow">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                className="fk-chip"
                style={{ cursor: "pointer", border: "none", font: "inherit", fontSize: 12.5 }}
                onClick={() => setPrompt(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Button onClick={go} disabled={busy || prompt.trim().length < 8 || left <= 0}>
              {busy ? "Writing…" : target === "new" ? "Write the form" : "Rewrite the questions"}
            </Button>
            <span style={{ fontSize: 13.5, color: "var(--color-text-tertiary)" }}>
              {left} of {viewer?.ai.limit ?? 0} form credits left this month
            </span>
          </div>

          {left <= 0 && (
            <div className="fk-note">
              <span>
                You have used every credit this month. They reset on the first, and everything you
                have already built is untouched.
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="fk-panel">
        <h3>What it does, and what it does not</h3>
        <p className="fk-panel-lede" style={{ marginBottom: 0 }}>
          It writes questions, pages and the welcome and thank-you screens. It does not publish
          anything, does not send email, and does not read your responses. Rewriting an existing
          form replaces its questions and leaves its answers, theme and settings alone.
        </p>
      </section>
    </>
  );
}
