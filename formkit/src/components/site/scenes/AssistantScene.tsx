"use client";

import { useRef, useState } from "react";
import { Bot, Check, Sparkles } from "lucide-react";
import { Chips, SceneFrame, useInView, useReducedMotion, useStep, type SceneProps } from "./shared";

/**
 * Formkit with AI on both sides: your assistant reads your responses and
 * shows them in the chat (the MCP app), and someone else's AI agent fills in
 * a form you opened to agents. Each plays out a step at a time.
 */

type Mode = "assistant" | "agent";

const ROWS = [
  ["Maya Okafor", "Website redesign", "New"],
  ["Tom Becker", "Rebrand", "Read"],
  ["Ana Ruiz", "Support plan", "New"],
] as const;

/** Steps: 0 the ask, 1 thinking, 2 the tool, 3 the result. */
const LAST = 3;

export function AssistantScene({ compact }: SceneProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref);
  const still = useReducedMotion();
  const [mode, setMode] = useState<Mode>("assistant");
  const [step, setStep] = useState(0);
  const live = seen && !still;
  const at = still ? LAST : step;

  useStep(live && step < LAST, step === 0 ? 900 : 1000, () => setStep(step + 1), [step, mode]);
  // Cards play both sides by themselves, one after the other.
  useStep(live && compact === true && step === LAST, 3600, () => {
    setMode(mode === "assistant" ? "agent" : "assistant");
    setStep(0);
  }, [step, mode]);

  return (
    <SceneFrame
      innerRef={ref}
      compact={compact}
      title={mode === "assistant" ? "Your AI assistant" : "Client onboarding · Responses"}
      label="An AI assistant shows this week's responses in a table inside the chat, and someone's AI agent fills in a form, which arrives labelled as sent by an agent."
      right={
        !compact && (
          <Chips
            label="Which side"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setStep(0);
            }}
            options={[
              { value: "assistant", label: "Your assistant" },
              { value: "agent", label: "Someone's agent" },
            ]}
          />
        )
      }
    >
      {mode === "assistant" ? (
        <div className="fk-as" key="assistant">
          <p className="fk-as-me">Show me this week&rsquo;s responses to Client onboarding</p>
          {at >= 1 && (
            <p className="fk-as-ai">
              <Sparkles size={13} strokeWidth={2} aria-hidden /> {at === 1 ? "Looking in Formkit…" : "Here they are. Two are new."}
            </p>
          )}
          {at >= 2 && <span className="fk-as-tool">Formkit · list_responses</span>}
          {at >= 3 && (
            <div className="fk-as-app">
              <div className="fk-as-apphead">
                <b>Responses</b>
                <span>3 this week</span>
              </div>
              <table>
                <tbody>
                  {ROWS.map(([who, what, status]) => (
                    <tr key={who}>
                      <td>{who}</td>
                      <td>{what}</td>
                      <td>
                        <span data-new={status === "New" || undefined}>{status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="fk-as" key="agent">
          <div className="fk-as-req">
            <span className="fk-as-verb">POST</span> formkit.app/api/agent/forms/onboarding
            <code>{`{ "agent": { "name": "Ada" }, "onBehalfOf": "Priya Shah", "answers": { … } }`}</code>
          </div>
          {at >= 1 && (
            <p className="fk-as-ai">
              <Check size={13} strokeWidth={2.4} aria-hidden /> {at === 1 ? "Checked like any answer: rules, required, spam" : "201 · Sent"}
            </p>
          )}
          {at >= 2 && (
            <div className="fk-as-row">
              <span className="fk-as-badge">
                <Bot size={13} strokeWidth={2} aria-hidden /> AI agent
              </span>
              <b>Priya Shah</b>
              <span>sent by Ada · just now</span>
            </div>
          )}
          {at >= 3 && <p className="fk-as-note">Off until you switch it on, form by form. Limited and labelled.</p>}
        </div>
      )}
    </SceneFrame>
  );
}
