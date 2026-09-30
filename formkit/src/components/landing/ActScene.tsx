"use client";

import { useRef, useState } from "react";
import { Mail, Sparkles } from "lucide-react";
import { SceneFrame, useInView, useReducedMotion, useStep } from "@/components/site/scenes/shared";

/**
 * "Act on every answer", as one window: the enquiries inbox. Pick a
 * response (or let it move through them) and see what the AI read in it and
 * the reply it wrote. Along the bottom, the week at a glance.
 */

type Mood = "positive" | "neutral" | "negative";

const PEOPLE: {
  id: string;
  name: string;
  org: string;
  said: string;
  mood: Mood;
  intent: string;
  score: number | null;
  when: string;
  reply: string;
}[] = [
  {
    id: "PS",
    name: "Priya Shah",
    org: "Bloom Bakery",
    said: "We're opening a second shop in March and need a site that takes orders online. Budget is around $6k.",
    mood: "positive",
    intent: "New website",
    score: 82,
    when: "Soon",
    reply:
      "Hi Priya, congratulations on the second shop! A site with online orders before March is very doable, and $6k fits our Starter Site. I'll send two times for a quick call tomorrow. Sam, Northstar Studio",
  },
  {
    id: "ML",
    name: "Marcus Lee",
    org: "Fieldnote",
    said: "Our site is slow and people drop off at checkout. We need it fixed before Black Friday.",
    mood: "neutral",
    intent: "Redesign",
    score: 74,
    when: "Urgent",
    reply:
      "Hi Marcus, a slow checkout before your busiest week is worth fixing first. We can start with a speed audit this week and have fixes live well before Black Friday. Sam, Northstar Studio",
  },
  {
    id: "HK",
    name: "Hana Kim",
    org: "Hana Ceramics",
    said: "Just curious what a small portfolio site would cost. No rush at all.",
    mood: "positive",
    intent: "Pricing question",
    score: 41,
    when: "Later",
    reply:
      "Hi Hana, thanks for asking. Small portfolio sites usually start at $2k, and I've attached three we've built for makers. Whenever you're ready, reply here. Sam, Northstar Studio",
  },
  {
    id: "TR",
    name: "Tom Reyes",
    org: "Velto",
    said: "Our last project ran two weeks late and nobody told us. Not happy.",
    mood: "negative",
    intent: "Complaint",
    score: null,
    when: "Urgent",
    reply:
      "Hi Tom, you're right, and I'm sorry we didn't tell you sooner. I've passed this to our director, who will call you today to put it right. Sam, Northstar Studio",
  },
];

const TOPICS = [
  { t: "New website", n: 14 },
  { t: "Pricing", n: 11 },
  { t: "Timeline", n: 9 },
  { t: "Support", n: 4 },
];

export function ActScene() {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref, 0.3);
  const still = useReducedMotion();
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const [typed, setTyped] = useState(0);
  const p = PEOPLE[at]!;
  const full = still ? p.reply.length : typed;
  const done = full >= p.reply.length;

  // The reply writes itself, then after a pause the next response comes up.
  useStep(seen && !still && !done, 16, () => setTyped((n) => Math.min(p.reply.length, n + 3)), [typed, at]);
  useStep(seen && !still && done && !held, 3200, () => {
    setAt((at + 1) % PEOPLE.length);
    setTyped(0);
  }, [at, done, held]);

  const pick = (i: number) => {
    setHeld(true);
    setAt(i);
    setTyped(0);
  };

  return (
    <div ref={ref}>
      <SceneFrame title="Enquiries · Inbox" label="AI reading each response and writing a reply" right={<span className="fk-act-pro">AI on</span>}>
        <div className="fk-act">
          <ul className="fk-act-list" role="listbox" aria-label="Responses">
            {PEOPLE.map((x, i) => (
              <li key={x.id}>
                <button type="button" role="option" aria-selected={i === at} onClick={() => pick(i)}>
                  <span className="fk-act-av" data-mood={x.mood}>
                    {x.id}
                  </span>
                  <span className="fk-act-who">
                    <b>{x.name}</b>
                    <small>{x.said}</small>
                  </span>
                  <span className="fk-act-score" data-empty={x.score === null || undefined}>
                    {x.score ?? "–"}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="fk-act-detail" key={p.id}>
            <div className="fk-act-said">
              <span>
                <b>{p.name}</b> · {p.org}
              </span>
              <q>{p.said}</q>
            </div>

            <div className="fk-act-read">
              <span className="fk-act-read-label">
                <Sparkles size={12} strokeWidth={2.2} aria-hidden /> The AI read
              </span>
              <span className="fk-act-chip" data-mood={p.mood}>
                {p.mood === "positive" ? "Positive" : p.mood === "negative" ? "Negative" : "Neutral"}
              </span>
              <span className="fk-act-chip">{p.intent}</span>
              <span className="fk-act-chip" data-urgent={p.when === "Urgent" || undefined}>
                {p.when}
              </span>
              {p.score !== null && (
                <span className="fk-act-meter" aria-label={`Lead score ${p.score}`}>
                  Lead score <i style={{ ["--s" as string]: `${p.score}%` }} /> <b>{p.score}</b>
                </span>
              )}
            </div>

            <div className="fk-act-reply">
              <span className="fk-act-reply-head">
                <span>
                  <Sparkles size={13} strokeWidth={2.2} aria-hidden /> Reply
                </span>
                <span className="fk-act-sent" data-on={done || undefined}>
                  <Mail size={12} strokeWidth={2.2} aria-hidden /> {done ? "Sent by email and on the thank-you screen" : "Writing…"}
                </span>
              </span>
              <p>
                {p.reply.slice(0, full)}
                {!done && <i className="fk-rs-caret" />}
              </p>
            </div>
          </div>
        </div>

        <div className="fk-act-week">
          <span className="fk-act-week-label">
            This week · <b>38</b> responses
          </span>
          <span className="fk-act-bar" aria-label="61% positive, 26% neutral, 13% negative">
            <i style={{ flexGrow: 61 }} data-mood="positive" />
            <i style={{ flexGrow: 26 }} data-mood="neutral" />
            <i style={{ flexGrow: 13 }} data-mood="negative" />
          </span>
          <span className="fk-act-topics">
            {TOPICS.map((t) => (
              <span key={t.t}>
                {t.t} <b>{t.n}</b>
              </span>
            ))}
          </span>
        </div>
      </SceneFrame>
    </div>
  );
}
