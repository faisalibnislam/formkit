"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle, Mail, MonitorSmartphone, Sparkles, Wand2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Field, Segmented, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, upgradeOnPlanError, useGate } from "@/components/plan/usePlan";
import { errorText } from "../settings/bits";
import { DraftArea, DraftPill } from "./Draft";
import { tracked } from "./saveStatus";

/**
 * Business: an AI-written reply to everyone who answers this form, from the
 * owner's own instructions - shown on the thank-you screen, emailed, or both.
 */

type Form = NonNullable<FunctionReturnType<typeof api.forms.get>>;
type Settings = {
  enabled: boolean;
  prompt: string;
  delivery: "form" | "email" | "both";
  style: "plain" | "branded";
  senderName?: string;
  signature?: string;
  subject?: string;
  knowledge?: string;
};
type Tried = FunctionReturnType<typeof api.aiReply.tryIt>;

const EXAMPLE = `You're replying for our digital agency.
- Thank them by first name.
- Look closely at the challenges they describe and respond positively and helpfully.
- Share one or two useful insights or facts that relate to their situation.
- Explain briefly how our agency could help with websites, SEO and paid ads, and invite them to book a free 20-minute call.
Keep it friendly, specific to what they wrote, and under 180 words.`;

const DEFAULTS: Settings = { enabled: false, prompt: "", delivery: "both", style: "branded" };

export function AiReplySection({ formId, form }: { formId: Id<"forms">; form: Form }) {
  const toast = useToast();
  const gate = useGate("ai.reply", form.ownerPlan?.features);
  const save = useMutation(api.aiReply.save);
  const tryIt = useAction(api.aiReply.tryIt);
  const usage = useQuery(api.aiReply.usage, {});
  const stored: Settings = { ...DEFAULTS, ...(form.aiReply ?? {}) };
  const [trying, setTrying] = useState(false);
  const [tried, setTried] = useState<Tried | null>(null);

  const hasEmailQuestion = form.blocks.some((b) => b.kind === "field" && b.type === "email");
  const emails = stored.delivery !== "form";

  async function put(patch: Partial<Settings>) {
    try {
      await tracked(save({ formId, settings: { ...stored, ...patch } }));
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not save."));
    }
  }

  async function go() {
    setTrying(true);
    try {
      setTried(await tryIt({ formId, settings: stored }));
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That didn’t work. Try again in a minute."));
    } finally {
      setTrying(false);
    }
  }

  return (
    <>
      <section className="fk-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Sparkles size={17} strokeWidth={1.8} aria-hidden style={{ display: "inline-block" }} />
          <h3 style={{ flex: 1, margin: 0 }}>AI replies</h3>
          {gate.locked && <ProChip plan="pro" onClick={() => openUpgrade({ feature: "ai.reply" })} />}
        </div>
        <p className="fk-panel-lede">
          Everyone who answers gets a reply written for them, from your instructions and what they told you. Without it,
          they get your usual confirmation, as set under Notifications.
        </p>

        <div className="fk-proprow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>Write a reply to every response</div>
            <div className="fk-proprow-hint">
              {usage && usage.pool.responses > 0
                ? `${Math.min(usage.used.responses, usage.pool.responses)} of ${usage.pool.responses} AI responses used this month${usage.credits ? ` · ${usage.credits} credits` : ""}. Out of both, people get your usual confirmation.`
                : "Pro includes 20 AI responses a month for each seat, then AI credits."}
            </div>
          </div>
          <Switch
            checked={stored.enabled}
            label="Write a reply to every response"
            onChange={gate.guard((enabled: boolean) => void put({ enabled }))}
          />
        </div>

        <Field label="Instructions for the AI">
          <DraftArea
            rows={7}
            value={stored.prompt}
            placeholder="What should the reply do? Who is it from, what should it look at, what should it offer?"
            onCommit={(prompt) => void put({ prompt })}
          />
        </Field>
        {!stored.prompt.trim() && (
          <Button
            variant="ghost"
            size="sm"
            style={{ marginTop: 6 }}
            iconLeft={<Wand2 size={15} strokeWidth={1.8} aria-hidden />}
            onClick={gate.guard(() => void put({ prompt: EXAMPLE }))}
          >
            Start from an example
          </Button>
        )}

        <div style={{ marginTop: 16 }}>
          <Field label="Background it can use (optional)">
            <DraftArea
              rows={4}
              value={stored.knowledge ?? ""}
              placeholder="Your services, prices, opening hours, links, answers to common questions. The AI never makes these up. It only uses what’s here."
              onCommit={(knowledge) => void put({ knowledge })}
            />
          </Field>
        </div>

        <div className="fk-proprow" style={{ marginTop: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>Where the reply goes</div>
            <div className="fk-proprow-hint">
              {emails && !hasEmailQuestion
                ? "Email needs an email question on the form. Add one under Build."
                : stored.delivery === "form"
                  ? "Shown on the thank-you screen as soon as it’s written."
                  : stored.delivery === "email"
                    ? "Emailed to the address they gave. It stands in for your usual confirmation."
                    : "Shown on the thank-you screen and emailed to them."}
            </div>
          </div>
          <Segmented
            ariaLabel="Where the reply goes"
            size="sm"
            value={stored.delivery}
            onChange={(delivery) => void put({ delivery })}
            options={[
              { value: "form", label: "On the form", icon: <MonitorSmartphone size={14} strokeWidth={1.8} aria-hidden /> },
              { value: "email", label: "By email", icon: <Mail size={14} strokeWidth={1.8} aria-hidden /> },
              { value: "both", label: "Both" },
            ]}
          />
        </div>
      </section>

      {emails && (
        <section className="fk-panel">
          <h3 style={{ margin: "0 0 6px" }}>The email</h3>
          <p className="fk-panel-lede">
            Sent from your own address when you’ve set one up under Settings → Email, and from Formkit’s otherwise.
          </p>
          <div className="fk-proprow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>Look</div>
              <div className="fk-proprow-hint">
                {stored.style === "plain"
                  ? "A plain-text email, like one you’d write yourself."
                  : "Your template, with the form’s logo and brand colour."}
              </div>
            </div>
            <Segmented
              ariaLabel="How the email looks"
              size="sm"
              value={stored.style}
              onChange={(style) => void put({ style })}
              options={[
                { value: "plain", label: "Plain text" },
                { value: "branded", label: "Branded" },
              ]}
            />
          </div>
          <div className="fk-aireply-grid">
            <Field label="Sender name">
              <DraftPill
                size="md"
                value={stored.senderName ?? ""}
                placeholder={form.identity?.name ?? "Your name or company"}
                onCommit={(senderName) => void put({ senderName })}
              />
            </Field>
            <Field label="Subject">
              <DraftPill
                size="md"
                value={stored.subject ?? ""}
                placeholder="Leave empty and the AI writes one"
                onCommit={(subject) => void put({ subject })}
              />
            </Field>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Signature">
              <DraftArea
                rows={3}
                value={stored.signature ?? ""}
                placeholder={"Maya Ortiz\nFounder, Studio Nine\nstudionine.co"}
                onCommit={(signature) => void put({ signature })}
              />
            </Field>
          </div>
        </section>
      )}

      <section className="fk-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h3 style={{ margin: "0 0 6px" }}>Try it</h3>
            <p className="fk-panel-lede" style={{ margin: 0 }}>
              Writes a reply to your latest response, or to made-up answers if there isn’t one yet. Nothing is sent, and it
              doesn’t use this month’s replies.
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={trying || !stored.prompt.trim()}
            iconLeft={<Sparkles size={15} strokeWidth={1.8} aria-hidden />}
            onClick={gate.guard(() => void go())}
          >
            {trying ? "Writing…" : tried ? "Try again" : "Write a sample reply"}
          </Button>
        </div>
        {tried && (
          <div className="fk-aireply-try">
            <div className="fk-aireply-letter">
              <div className="fk-aireply-subject">{tried.subject}</div>
              <div className="fk-aireply-body">{tried.reply}</div>
              {stored.signature && <div className="fk-aireply-body fk-aireply-sig">{stored.signature}</div>}
            </div>
            <div className="fk-aireply-side">
              {tried.needsHuman && (
                <p className="fk-aireply-flag">
                  <AlertTriangle size={14} strokeWidth={1.8} aria-hidden /> The AI would flag this one for a person.
                </p>
              )}
              {tried.insight && <InsightChips insight={tried.insight} />}
              <details>
                <summary>{tried.made ? "Made-up answers it replied to" : "The response it replied to"}</summary>
                <dl className="fk-aireply-sample">
                  {tried.sample.map((r, i) => (
                    <div key={i}>
                      <dt>{r.question}</dt>
                      <dd>{r.answer}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

type Insight = {
  sentiment: "positive" | "neutral" | "negative";
  intent?: string;
  topics: string[];
  score?: number;
  urgency?: "low" | "medium" | "high";
  summary?: string;
};

/** What the AI read in a response: its mood, what they want, how promising it is. */
export function InsightChips({ insight }: { insight: Insight }) {
  return (
    <div className="fk-insight">
      {insight.summary && <p className="fk-insight-summary">{insight.summary}</p>}
      <div className="fk-insight-chips">
        <span className="fk-insight-chip" data-tone={insight.sentiment}>
          {insight.sentiment === "positive" ? "Positive" : insight.sentiment === "negative" ? "Negative" : "Neutral"}
        </span>
        {insight.urgency && (
          <span className="fk-insight-chip" data-tone={insight.urgency === "high" ? "negative" : undefined}>
            {insight.urgency === "high" ? "Urgent" : insight.urgency === "medium" ? "Soon" : "Not urgent"}
          </span>
        )}
        {typeof insight.score === "number" && <span className="fk-insight-chip">Score {insight.score}</span>}
        {insight.intent && <span className="fk-insight-chip">{insight.intent}</span>}
        {insight.topics.map((t) => (
          <span key={t} className="fk-insight-chip" data-tone="topic">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
