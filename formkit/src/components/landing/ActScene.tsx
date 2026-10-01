"use client";

import { useRef, useState } from "react";
import { Check, Hash, Mail, Sparkles, Table2 } from "lucide-react";
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
  /** What the AI picks out of the message, in the order it appears. */
  keys: string[];
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
    keys: ["second shop in March", "takes orders online", "around $6k"],
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
    keys: ["is slow", "drop off at checkout", "before Black Friday"],
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
    keys: ["small portfolio site", "No rush"],
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
    keys: ["two weeks late", "nobody told us", "Not happy"],
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

/** Where each reply and response goes once it is sent. */
const OUT = [
  { icon: Mail, text: (name: string) => `Emailed to ${name.split(" ")[0]}` },
  { icon: Hash, text: () => "Slack #new-leads" },
  { icon: Table2, text: () => "Added to Sheets" },
];

/** The message cut into plain runs and the phrases the AI marks. */
function split(said: string, keys: string[]) {
  const parts: { t: string; k: number }[] = [];
  let rest = said;
  keys.forEach((key, i) => {
    const at = rest.indexOf(key);
    if (at < 0) return;
    if (at > 0) parts.push({ t: rest.slice(0, at), k: -1 });
    parts.push({ t: key, k: i });
    rest = rest.slice(at + key.length);
  });
  if (rest) parts.push({ t: rest, k: -1 });
  return parts;
}

export function ActScene() {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useInView(ref, 0.3);
  const still = useReducedMotion();
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const [typed, setTyped] = useState(0);
  const [read, setRead] = useState(0);
  const p = PEOPLE[at]!;
  const marked = still ? p.keys.length : read;
  const readDone = marked >= p.keys.length;
  const full = still ? p.reply.length : typed;
  const done = full >= p.reply.length;

  // The AI marks what matters, the reply writes itself, it goes out, then the next response comes up.
  useStep(seen && !still && !readDone, 380, () => setRead(read + 1), [read, at]);
  useStep(seen && !still && readDone && !done, 16, () => setTyped((n) => Math.min(p.reply.length, n + 3)), [typed, at, readDone]);
  useStep(seen && !still && done && !held, 3600, () => {
    setAt((at + 1) % PEOPLE.length);
    setTyped(0);
    setRead(0);
  }, [at, done, held]);

  const pick = (i: number) => {
    setHeld(true);
    setAt(i);
    setTyped(0);
    setRead(0);
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
              <q data-reading={!readDone || undefined}>
                {split(p.said, p.keys).map((x, i) =>
                  x.k < 0 ? (
                    <span key={i}>{x.t}</span>
                  ) : (
                    <mark key={i} data-on={x.k < marked || undefined}>
                      {x.t}
                    </mark>
                  ),
                )}
              </q>
            </div>

            <div className="fk-act-read" data-on={readDone || undefined}>
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
                  <Mail size={12} strokeWidth={2.2} aria-hidden /> {done ? "Sent" : readDone ? "Writing…" : "Reading…"}
                </span>
              </span>
              <p>
                {readDone ? p.reply.slice(0, full) : <span className="fk-act-wait">Reading the response…</span>}
                {readDone && !done && <i className="fk-rs-caret" />}
              </p>
              <span className="fk-act-out" data-on={done || undefined}>
                {OUT.map((o, i) => (
                  <span key={i} style={{ ["--i" as string]: i }}>
                    <o.icon size={12} strokeWidth={2.2} aria-hidden /> {o.text(p.name)}
                    <Check size={12} strokeWidth={2.6} aria-hidden className="fk-act-tick" />
                  </span>
                ))}
              </span>
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
