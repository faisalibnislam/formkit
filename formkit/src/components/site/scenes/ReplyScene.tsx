"use client";

import { useRef, useState } from "react";
import { Mail, Sparkles } from "lucide-react";
import { Chips, SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "./shared";

/**
 * A response arrives, the AI reads it, and a reply is written from the
 * owner's instructions. Change the instructions and the reply changes.
 */

const RESPONSE = {
  name: "Priya Shah",
  company: "Bloom Bakery",
  need: "A website",
  said: "We're opening a second shop in March and need a site that takes orders online. Budget is around $6k.",
};

const BRIEFS = [
  {
    key: "warm",
    label: "Warm and brief",
    reply:
      "Hi Priya, congratulations on the second shop! A site with online orders before March is very doable, and $6k fits our Starter Site well. I'll send two times for a quick call tomorrow. Sam, Northstar Studio",
  },
  {
    key: "formal",
    label: "Formal",
    reply:
      "Dear Priya, thank you for your enquiry. A website with online ordering can be delivered before your March opening within a budget of $6,000. I will contact you tomorrow to arrange an introductory call. Kind regards, Sam Lee, Northstar Studio",
  },
  {
    key: "call",
    label: "Offer a call",
    reply:
      "Hi Priya, thanks for getting in touch. Online orders for a March opening is exactly what we do. Could you grab 20 minutes this week? Pick any time at northstar.studio/call and we'll plan it together. Sam",
  },
] as const;

type Key = (typeof BRIEFS)[number]["key"];

export function ReplyScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [brief, setBrief] = useState<Key>("warm");
  const [stage, setStage] = useState<"reading" | "writing">("reading");
  const [chars, setChars] = useState(0);
  const on = seen && !still;
  const text = BRIEFS.find((b) => b.key === brief)!.reply;

  useStep(on && stage === "reading", 1300, () => setStage("writing"), [brief]);
  useStep(on && stage === "writing" && chars < text.length, 14, () => setChars(Math.min(text.length, chars + 3)), [chars, brief]);
  // On the index, move through the three sets of instructions.
  useStep(on && !!compact && chars >= text.length, 3000, () => {
    const i = BRIEFS.findIndex((b) => b.key === brief);
    change(BRIEFS[(i + 1) % BRIEFS.length]!.key);
  }, [chars, brief]);

  function change(k: Key) {
    setBrief(k);
    setChars(0);
    setStage("reading");
  }

  const reading = !still && stage === "reading";
  const shown = still ? text : text.slice(0, chars);

  return (
    <SceneFrame
      innerRef={ref}
      compact={compact}
      title="New response · Enquiry"
      label="A response arrives, and AI writes the person a reply from the owner's instructions."
    >
      <div className="fk-rp">
        <div className="fk-rp-in">
          <span className="fk-rp-av" aria-hidden>
            PS
          </span>
          <div>
            <b>
              {RESPONSE.name} <span>· {RESPONSE.company}</span>
            </b>
            <span className="fk-rp-need">What do you need? {RESPONSE.need}</span>
            <p>“{RESPONSE.said}”</p>
          </div>
        </div>

        <div className="fk-rp-tags" data-on={!reading || undefined}>
          <span data-tone="green">Positive</span>
          <span>New website</span>
          <span data-tone="blue">Lead score 82</span>
          <span data-tone="yellow">Soon</span>
        </div>

        {!compact && (
          <div className="fk-rp-brief">
            <span>Your instructions</span>
            <Chips
              label="Instructions"
              value={brief}
              onChange={change}
              options={BRIEFS.map((b) => ({ value: b.key, label: b.label }))}
            />
          </div>
        )}

        <div className="fk-rp-out" data-reading={reading || undefined}>
          <span className="fk-rp-who">
            <Sparkles size={14} strokeWidth={2} aria-hidden />
            {reading ? "Reading the response…" : "Reply"}
            <span className="fk-rp-via">
              <Mail size={13} strokeWidth={2} aria-hidden /> Email and thank-you screen
            </span>
          </span>
          {reading ? (
            <span className="fk-rp-lines" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          ) : (
            <p>
              {shown}
              {shown.length < text.length && <i className="fk-ai-caret" aria-hidden />}
            </p>
          )}
        </div>
      </div>
    </SceneFrame>
  );
}
