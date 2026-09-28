"use client";

import { useViewer } from "@/lib/seed";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, GitBranch, MessageSquarePlus, Palette, PenLine, Sparkles, Wand2 } from "lucide-react";
import { Segmented } from "@/components/ui";
import { useAskMaybe } from "./ai/AskProvider";
import { AskCanvas, AskComposer, AskCredits, AskTarget, AskThread } from "./ai/AskParts";
import { PageSkeleton } from "./Skeleton";

/**
 * Ask Formkit, full page: the conversation on the left, what it builds or
 * changes on the right, stacked with a switch between them on a narrow screen.
 *
 * This page exists only for an account on the allow-list; the shell does not
 * link to it otherwise, and the server refuses. There is no locked state here
 * on purpose - an account without access should never learn the feature exists.
 */

const SUGGESTIONS = [
  "A client intake form for a small design studio",
  "An event sign-up with dietary and access needs",
  "A job application for a junior developer, with a CV upload",
  "A short feedback form after a workshop",
  "A weekly check-in for a small team",
];

const ABILITIES = [
  { icon: Wand2, label: "Write a whole form from a sentence, a brief or a document", cost: "1 credit" },
  { icon: MessageSquarePlus, label: "Add questions to a form you already have", cost: "Free" },
  { icon: PenLine, label: "Rewrite the questions in another tone", cost: "Free" },
  { icon: GitBranch, label: "Write the logic rules", cost: "Free" },
  { icon: Palette, label: "Pick a theme to suit it", cost: "Free" },
  { icon: BarChart3, label: "Tell you what the responses are saying", cost: "Free" },
];

export function AskFormkit() {
  const router = useRouter();
  const viewer = useViewer();
  const ask = useAskMaybe();
  // The narrow layout follows the work: a new result or a request in flight
  // shows the canvas, until the person switches back themselves.
  const [choice, setChoice] = useState<{ pane: "chat" | "work"; at: string } | null>(null);

  // Taken away while the page is open: back to the dashboard, without a trace.
  useEffect(() => {
    if (viewer && !viewer.ai.allowed) router.replace("/app");
  }, [viewer, router]);

  const at = `${ask?.busy}-${ask?.canvas?.kind}-${ask?.thread.length}`;
  const auto = ask?.busy || ask?.canvas ? "work" : "chat";
  const pane = choice && choice.at === at ? choice.pane : auto;
  const setPane = (next: "chat" | "work") => setChoice({ pane: next, at });

  if (!viewer || !ask) return <PageSkeleton kind="panel" />;

  if (!ask.thread.length) {
    return (
      <div className="fk-ask-empty">
        <section className="fk-panel fk-ask-hero">
          <div>
            <h2>What should this form do?</h2>
            <p>
              Describe it in a sentence. Formkit writes the questions, picks the types, marks what has to be answered
              and sets the welcome and thank-you screens.
            </p>
          </div>
          <div className="fk-ask-hero-target">
            <span className="fk-ask-quiet">Working on</span>
            <AskTarget />
          </div>
          <AskComposer autoFocus />
          <AskCredits />
        </section>

        <div className="fk-ask-suggest">
          <span className="fk-ask-quiet">Or start from one of these</span>
          <div className="fk-ask-chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => void ask.send(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <section className="fk-panel">
          <h3>What Formkit can do here</h3>
          <div className="fk-ask-abilities">
            {ABILITIES.map((a) => (
              <div key={a.label}>
                <span className="fk-ask-menu-icon">
                  <a.icon size={16} strokeWidth={1.8} aria-hidden />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>{a.label}</span>
                <span className="fk-ask-cost" data-free={a.cost === "Free" ? "true" : undefined}>
                  {a.cost}
                </span>
              </div>
            ))}
          </div>
          <p className="fk-panel-lede" style={{ margin: "14px 0 0" }}>
            It does not publish anything, send email or delete questions. Whatever it writes is yours to change
            afterwards, and nothing that identifies the people who answered is ever sent to it.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="fk-ask-work" data-pane={pane}>
      <div className="fk-ask-panes">
        <Segmented
          ariaLabel="Show"
          value={pane}
          onChange={setPane}
          options={[
            { value: "chat", label: "Chat" },
            { value: "work", label: ask.busy ? "Working" : "Canvas" },
          ]}
        />
      </div>
      <section className="fk-panel fk-ask-chat">
        <div className="fk-ask-chat-head">
          <span className="fk-ask-chat-title">
            <Sparkles size={15} strokeWidth={1.8} aria-hidden /> Ask Formkit
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" className="fk-ask-link" onClick={ask.newChat} disabled={ask.busy}>
            New chat
          </button>
        </div>
        <div className="fk-ask-hero-target">
          <span className="fk-ask-quiet">Working on</span>
          <AskTarget />
        </div>
        <AskThread />
        <AskComposer />
        <AskCredits compact />
      </section>
      <section className="fk-panel fk-ask-canvas">
        <AskCanvas />
      </section>
    </div>
  );
}
