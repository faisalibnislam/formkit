"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowLeft, Check, CornerDownLeft, CreditCard, Lock, Paperclip } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  cleanCss,
  LOGO_PX,
  SIZE_SCALE,
  WEIGHTS,
  buttonInk,
  themeOf,
} from "@/components/app/editor/themes";
import { fontStack, loadFont } from "@/components/app/editor/fonts";
import { computeAll, pipe, pipeValues } from "../../../convex/model/calc";
import { LiveReply } from "./LiveReply";
import { applyLogic, conditionsOf, type Rule as LogicRule } from "../../../convex/model/logicEval";
import { LogoLockup } from "./LogoLockup";

/**
 * The form, as somebody answering it sees it — on the public link, and in the
 * builder's preview, which runs this same component.
 *
 * Things that matter here and are easy to get wrong:
 *  - Leaving keeps what was answered. The partial is saved on the way out and
 *    carries a token, so the owner can send the person back to it.
 *  - Logic is evaluated on every answer, and a hidden question is never
 *    required — otherwise a form can become impossible to finish.
 *  - Required means required: the page will not advance, and the message says
 *    which question is waiting.
 *  - Classic puts a page of questions on screen; conversational asks one at a
 *    time, with Enter to go on and the submit button always in reach.
 */

export type Block = {
  _id: Id<"blocks">;
  kind: "field" | "pagebreak";
  type: string | null;
  title: string | null;
  help: string | null;
  placeholder: string | null;
  required: boolean;
  options: string[] | null;
  accept: string[] | null;
  scaleMin: number | null;
  scaleMax: number | null;
  pageName: string | null;
  /** Pro: pre-fill, piping and formulas read a question by its key. */
  key?: string | null;
  scores?: number[] | null;
  defaultValue?: string | null;
  /** Pro: places left per option; null where an option has no limit. */
  left?: (number | null)[] | null;
  /** Business: a hidden field AI fills from another answer. */
  extract?: { from: Id<"blocks"> } | null;
};

type Rule = LogicRule;

/** Another ending a rule can lead to (Pro). */
export type Ending = {
  id: string;
  name: string;
  title: string;
  message: string;
  buttonLabel?: string;
  buttonUrl?: string;
  redirect?: string;
};

export type Answer = { value?: string; values?: string[]; fileId?: Id<"_storage">; fileName?: string };

export type OpenForm = {
  aiReply?: { delivery: "form" | "email" | "both" } | null;
  formId: Id<"forms">;
  title: string;
  brand: { name: string; logoUrl: string | null; color: string | null; badge?: boolean };
  logos: { name: string; url: string | null }[];
  welcome: { title: string; message: string; button?: string } | null;
  thanks: {
    title: string;
    message: string;
    buttonLabel?: string;
    buttonUrl?: string;
    redirect?: string;
  } | null;
  theme: unknown;
  closedMessage: string;
  uploadCapMb: number;
  rules: { spam: boolean; requireEmail: boolean; editAfter: boolean; multiple: boolean; partials?: boolean };
  blocks: Block[];
  logic: Rule[];
  /** Which smarter-form features the owner's plan turns on. */
  smart?: { hidden: boolean; piping: boolean; calc: boolean; redirect: boolean; ai?: boolean };
  /** Pro: endings logic rules can lead to, besides `thanks`. */
  endings?: Ending[];
  calc?: { name: string; formula: string }[];
  /** Pro: the brand's own font file and custom CSS, when the owner's plan has them. */
  custom?: { font: { name: string; url: string } | null; css: string | null } | null;
  /** Pro: people go on to pay, through the owner's Stripe, after sending. */
  payment?: { label: string | null; currency: string; amount: number | null; fromCalc: string | null } | null;
};

/** What a sent response comes back as. */
export type Submitted = { resumeToken: string; responseId?: Id<"responses">; pay?: boolean };

export type SubmitArgs = {
  partial: boolean;
  human?: boolean;
  trap?: string;
  durationMs?: number;
  device?: string;
  /** The ending the answers led to, when it was not the default. */
  ending?: string;
  answers: ({ blockId: Id<"blocks"> } & Answer)[];
};

/** Clock reads live out here, where they are not part of a render. */
const now = () => Date.now();
const since = (from: number) => (from ? now() - from : undefined);

const filled = (a?: Answer) => !!(a?.value?.trim() || a?.values?.length || a?.fileId);

export function FormRunner({
  data,
  mode,
  closed = false,
  resume,
  onSubmit,
  onPay,
  onStart,
  onThink,
  upload,
  scrollRoot,
}: {
  data: OpenForm;
  mode: "live" | "preview";
  /** Show the closed screen instead of the questions. */
  closed?: boolean;
  /** Answers already given — a partial being finished, or a response being changed. */
  resume?: { token: string; answers: Record<string, Answer>; editing: boolean };
  onSubmit: (args: SubmitArgs) => Promise<Submitted>;
  /** Opens the payment page for a response that owes one; the live form only. */
  onPay?: (r: { responseId: Id<"responses">; resumeToken: string }) => Promise<{ url: string } | { paid: true } | null>;
  onStart?: () => void;
  /** Business: asks the AI about answers when a page is finished. The live form only. */
  onThink?: (a: {
    checks: string[];
    facts: string[];
    answers: { blockId: string; text: string }[];
  }) => Promise<{ judged: Record<string, boolean>; extracted: Record<string, string> }>;
  upload: (file: File) => Promise<Id<"_storage">>;
  /** What scrolls — the window, or the preview's own frame. */
  scrollRoot?: RefObject<HTMLElement | null>;
}) {
  const theme = themeOf(data.theme);
  const scale = SIZE_SCALE[theme.size];
  const ink = buttonInk(theme.primary);
  const blocks = data.blocks;
  const conversational = theme.flow === "conversational";
  const standalone = blocks[0]?.kind === "pagebreak";

  const [started, setStarted] = useState(!!resume || !standalone);
  const [page, setPage] = useState(0);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => resume?.answers ?? prefilled(blocks, data.smart?.hidden === true));
  // Hidden fields are sent with the answers but never shown.
  const hiddenFields = blocks.filter((b) => b.type === "hidden");
  const [problem, setProblem] = useState<string | null>(null);
  const [fileProblem, setFileProblem] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ token: string; responseId?: Id<"responses">; paying?: boolean; ending?: string | null } | null>(null);
  const [payProblem, setPayProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [prove, setProve] = useState(false);
  const [human, setHuman] = useState(false);
  const [trap, setTrap] = useState("");
  const openedAt = useRef(0);
  const savedPartial = useRef(false);

  useEffect(() => {
    openedAt.current = now();
  }, []);

  const toTop = () => {
    const el = scrollRoot?.current;
    if (el) el.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
  };

  /* ---------- calculations and piping (Pro) ---------- */
  const results = useMemo(
    () => (data.smart?.calc && data.calc?.length ? computeAll(data.calc, blocks, answers) : {}),
    [data.smart?.calc, data.calc, blocks, answers],
  );
  const piped = useMemo(() => pipeValues(blocks, answers, results), [blocks, answers, results]);

  /* ---------- logic ---------- */
  // Business: what the AI said about answers, by condition id, once asked.
  const [judged, setJudged] = useState<Record<string, boolean>>({});
  const [thinking, setThinking] = useState(false);
  // The answer each AI condition or hidden field was last asked about.
  const askedWith = useRef<Record<string, string>>({});
  const types = useMemo(() => Object.fromEntries(blocks.map((b) => [b._id as string, b.type])), [blocks]);
  const outcome = useMemo(
    () => applyLogic(data.logic, { answers, calc: results, ai: judged, types }),
    [answers, data.logic, results, judged, types],
  );
  const { hidden, forced, jumpTo, hiddenOptions } = outcome;
  /** Text with {{key}} filled in from earlier answers, when the plan has piping. */
  const say = (text: string | null | undefined) => (data.smart?.piping ? pipe(text, piped) : (text ?? ""));

  // An option a rule hides counts as not picked, and is never sent.
  const kept = useMemo(() => {
    if (!hiddenOptions.size) return answers;
    const next = { ...answers };
    for (const [id, gone] of hiddenOptions) {
      const a = answers[id];
      if (!a) continue;
      if (a.value && gone.has(a.value)) next[id] = { ...a, value: undefined };
      if (a.values?.some((v) => gone.has(v))) next[id] = { ...a, values: a.values.filter((v) => !gone.has(v)) };
    }
    return next;
  }, [answers, hiddenOptions]);

  /* ---------- pages, and the questions in order ---------- */
  const pagesFor = (gone: Set<string>) => {
    const pages: { name: string; fields: Block[] }[] = [{ name: "", fields: [] }];
    for (const b of blocks) {
      if (b.kind === "pagebreak") pages.push({ name: b.pageName ?? "", fields: [] });
      else if (b.type !== "hidden" && !gone.has(b._id)) pages[pages.length - 1]!.fields.push(b);
    }
    return pages.filter((p) => p.fields.length > 0);
  };
  const live = pagesFor(hidden);
  const fields = live.flatMap((p) => p.fields);
  const current = live[Math.min(page, Math.max(0, live.length - 1))];
  const lastPage = page >= live.length - 1;
  const cur = fields[Math.min(step, Math.max(0, fields.length - 1))];
  const lastStep = step >= fields.length - 1;
  const answeredCount = fields.filter((b) => filled(kept[b._id])).length;

  function isRequired(b: Block) {
    // A hidden question is never required, or the form cannot be finished.
    if (hidden.has(b._id)) return false;
    if (b.required || forced.has(b._id)) return true;
    return data.rules.requireEmail && b.type === "email";
  }
  const firstMissing = (list: Block[]) => list.find((b) => isRequired(b) && !filled(kept[b._id]));

  // Leaving keeps what was answered.
  useEffect(() => {
    // Switched off for the owner's account, a half-finished form is not kept.
    if (mode !== "live" || data.rules.partials === false) return;
    const save = () => {
      if (savedPartial.current || done) return;
      const given = Object.entries(answers).filter(([, a]) => filled(a));
      if (!given.length) return;
      savedPartial.current = true;
      void onSubmit({
        partial: true,
        device: describeDevice(),
        durationMs: since(openedAt.current),
        answers: given.map(([blockId, a]) => ({ blockId: blockId as Id<"blocks">, ...a })),
      }).catch(() => {});
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [answers, done, mode, onSubmit, data.rules.partials]);

  // A redirect after submitting, on the live form only — with {{keys}} filled in.
  const endingNow = done?.ending ? data.endings?.find((e) => e.id === done.ending) : undefined;
  const finalRedirect = endingNow ? endingNow.redirect : data.thanks?.redirect;
  const redirectTo = finalRedirect
    ? data.smart?.piping
      ? pipe(finalRedirect, piped, true)
      : finalRedirect
    : null;
  useEffect(() => {
    if (!done || done.paying || mode !== "live" || !redirectTo || !/^https?:\/\//i.test(redirectTo)) return;
    const t = window.setTimeout(() => window.location.assign(redirectTo), 1400);
    return () => window.clearTimeout(t);
  }, [done, mode, redirectTo]);

  async function send(asHuman = human, over?: { answers?: Record<string, Answer>; ending?: string | null }) {
    const sending = over?.answers ?? kept;
    const ending = over && "ending" in over ? over.ending : outcome.ending;
    setBusy(true);
    setFailed(null);
    try {
      savedPartial.current = true;
      const r = await onSubmit({
        partial: false,
        human: asHuman || undefined,
        trap: trap || undefined,
        device: describeDevice(),
        durationMs: since(openedAt.current),
        ending: ending ?? undefined,
        answers: Object.entries(sending)
          .filter(([id]) => fields.some((f) => f._id === id) || hiddenFields.some((f) => f._id === id))
          .map(([blockId, a]) => ({ blockId: blockId as Id<"blocks">, ...a })),
      });
      setProve(false);
      const paying = !!(r.pay && r.responseId && onPay && mode === "live");
      setDone({ token: r.resumeToken, responseId: r.responseId, paying, ending });
      toTop();
      if (paying) void goPay(r.responseId!, r.resumeToken);
    } catch (e) {
      savedPartial.current = false;
      const data = (e as { data?: unknown }).data;
      if (data && typeof data === "object" && (data as { code?: string }).code === "prove") {
        setProve(true);
      } else {
        const msg = typeof data === "string" ? data : e instanceof Error ? e.message : "";
        setFailed(msg || "That did not send. Try again in a moment.");
      }
    } finally {
      setBusy(false);
    }
  }

  /** Sends the person on to Stripe; the answers are already saved. */
  async function goPay(responseId: Id<"responses">, resumeToken: string) {
    if (!onPay) return;
    setPayProblem(null);
    try {
      const next = await onPay({ responseId, resumeToken });
      if (next && "url" in next) {
        try {
          window.sessionStorage.setItem("fk.pay", JSON.stringify({ responseId, resumeToken }));
        } catch {
          /* Coming back to try again just will not be offered. */
        }
        window.location.assign(next.url);
        return;
      }
      setDone((d) => (d ? { ...d, paying: false } : d));
    } catch (e) {
      const data = (e as { data?: unknown }).data;
      setPayProblem(typeof data === "string" ? data : "The payment page did not open. Try again in a moment.");
    }
  }

  /**
   * Business: asks the AI about the answers just given — its yes-or-no
   * conditions and the hidden fields it fills — and works the rules out
   * again with what it said. Never holds anyone up for long: after a few
   * seconds, or on any failure, the form goes on with the fallbacks.
   */
  async function think(list: Block[]) {
    const same = { answers: kept, judged, outcome };
    if (!onThink || mode !== "live" || !data.smart?.ai) return same;
    const onPage = new Set(list.map((b) => b._id as string));
    const textOf = (id: string) => {
      const a = kept[id];
      return (a?.values?.join(", ") ?? a?.value ?? "").trim();
    };
    const checks = data.logic
      .flatMap((r) => conditionsOf(r))
      .filter((c) => c.source === "ai" && c.id && c.blockId && onPage.has(c.blockId))
      .filter((c) => textOf(c.blockId!) && askedWith.current[c.id!] !== textOf(c.blockId!));
    const facts = blocks.filter(
      (b) => b.extract && onPage.has(b.extract.from) && textOf(b.extract.from) && askedWith.current[b._id] !== textOf(b.extract.from),
    );
    if (!checks.length && !facts.length) return same;

    const read = new Set([...checks.map((c) => c.blockId!), ...facts.map((f) => f.extract!.from as string)]);
    setThinking(true);
    try {
      const res = await Promise.race([
        onThink({
          checks: [...new Set(checks.map((c) => c.id!))],
          facts: facts.map((f) => f._id as string),
          answers: [...read].map((blockId) => ({ blockId, text: textOf(blockId) })),
        }),
        new Promise<null>((r) => window.setTimeout(() => r(null), 10_000)),
      ]).catch(() => null);
      for (const c of checks) askedWith.current[c.id!] = textOf(c.blockId!);
      for (const f of facts) askedWith.current[f._id] = textOf(f.extract!.from);
      if (!res) return same;
      const nextJudged = { ...judged, ...res.judged };
      const nextAnswers = { ...kept };
      for (const [id, value] of Object.entries(res.extracted)) nextAnswers[id] = { value };
      setJudged(nextJudged);
      if (Object.keys(res.extracted).length) setAnswers((a) => ({ ...a, ...Object.fromEntries(Object.entries(res.extracted).map(([id, value]) => [id, { value }])) }));
      const calc = data.smart?.calc && data.calc?.length ? computeAll(data.calc, blocks, nextAnswers) : {};
      return { answers: nextAnswers, judged: nextJudged, outcome: applyLogic(data.logic, { answers: nextAnswers, calc, ai: nextJudged, types }) };
    } finally {
      setThinking(false);
    }
  }

  async function nextPage() {
    const missing = firstMissing(current?.fields ?? []);
    if (missing) {
      setProblem(missing._id);
      document.getElementById(`q-${missing._id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    setProblem(null);
    const now = await think(current?.fields ?? []);
    if (!lastPage) {
      // A matching "jump to" rule skips straight to the page that holds its
      // question, as long as that page is ahead of this one.
      const pagesNow = pagesFor(now.outcome.hidden);
      const to = now.outcome.jumpTo;
      const jumpPage = to ? pagesNow.findIndex((p) => p.fields.some((f) => f._id === to)) : -1;
      setPage(jumpPage > page ? jumpPage : page + 1);
      toTop();
      return;
    }
    void send(human, { answers: now.answers, ending: now.outcome.ending });
  }

  async function nextStep() {
    if (!cur) return;
    if (isRequired(cur) && !filled(kept[cur._id])) {
      setProblem(cur._id);
      return;
    }
    setProblem(null);
    const now = await think([cur]);
    if (!lastStep) {
      const to = now.outcome.jumpTo;
      const fieldsNow = pagesFor(now.outcome.hidden).flatMap((p) => p.fields);
      const jumpIndex = to ? fieldsNow.findIndex((f) => f._id === to) : -1;
      setStep(jumpIndex > step ? jumpIndex : step + 1);
      return;
    }
    const missing = firstMissing(fields);
    if (missing) {
      setStep(fields.indexOf(missing));
      setProblem(missing._id);
      return;
    }
    void send(human, { answers: now.answers, ending: now.outcome.ending });
  }

  async function attach(block: Block, file: File) {
    if (file.size > data.uploadCapMb * 1024 * 1024) {
      setFileProblem((p) => ({ ...p, [block._id]: `That file is over ${data.uploadCapMb} MB. Try a smaller one.` }));
      return;
    }
    const allowed = block.accept ?? [];
    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (allowed.length && !allowed.includes(ext)) {
      setFileProblem((p) => ({
        ...p,
        [block._id]: `This question takes ${allowed.join(" ")} files. Try one of those.`,
      }));
      return;
    }
    setFileProblem((p) => {
      const next = { ...p };
      delete next[block._id];
      return next;
    });
    try {
      const fileId = await upload(file);
      setAnswers((a) => ({ ...a, [block._id]: { fileId, fileName: file.name } }));
    } catch {
      setFileProblem((p) => ({ ...p, [block._id]: "That upload did not finish. Try again." }));
    }
  }

  const button = (primary: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 52,
    padding: "0 28px",
    border: "none",
    borderRadius: Math.min(theme.radius, 999),
    background: primary ? theme.primary : "rgba(0,0,0,.06)",
    color: primary ? ink : "inherit",
    font: "inherit",
    fontSize: 16 * scale,
    fontWeight: 500,
    cursor: busy ? "progress" : "pointer",
  });

  const credit = data.brand.badge === false ? null : <div className="fk-live-credit">Made with Formkit</div>;
  const split = theme.layout === "split";

  /* ---------- closed ---------- */
  if (closed) {
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
        <div style={{ paddingTop: "8vh", textAlign: "center" }}>
          <span className="fk-live-lock">
            <Lock size={30} strokeWidth={1.8} aria-hidden />
          </span>
          <h1 style={{ marginTop: 22 }}>This form is closed</h1>
          <p className="fk-live-lede">{data.closedMessage}</p>
        </div>
      </Shell>
    );
  }

  /* ---------- sent ---------- */
  if (done?.paying) {
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
        <div style={{ textAlign: split ? "left" : "center", paddingTop: "4vh" }}>
          <span className="fk-live-lock" style={{ background: theme.primary, color: ink }}>
            <CreditCard size={30} strokeWidth={1.8} aria-hidden />
          </span>
          <h1 style={{ marginTop: 22 }}>{payProblem ? "One more step" : "Taking you to payment…"}</h1>
          <p className="fk-live-lede">
            {payProblem ?? "Your answers are saved. Payment is handled securely by Stripe."}
          </p>
          {payProblem && (
            <div className="fk-live-foot" style={{ justifyContent: split ? "flex-start" : "center" }}>
              <button type="button" style={button(true)} onClick={() => void goPay(done.responseId!, done.token)}>
                Try again
              </button>
            </div>
          )}
        </div>
        {credit}
      </Shell>
    );
  }

  if (done) {
    const t = endingNow ?? data.thanks;
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
        <div style={{ textAlign: split ? "left" : "center", paddingTop: "4vh" }}>
          <span className="fk-live-lock" style={{ background: theme.primary, color: ink }}>
            <Check size={30} strokeWidth={2} aria-hidden />
          </span>
          <h1 style={{ marginTop: 22 }}>{say(t?.title) || "Thank you"}</h1>
          <p className="fk-live-lede">{say(t?.message) || "Your answers are in."}</p>
          {data.aiReply && mode === "live" && done.responseId && (
            <LiveReply responseId={done.responseId} token={done.token} />
          )}
          {data.aiReply && mode === "preview" && (
            <p className="fk-live-note">
              On the live form, a reply written by AI for this person shows here
              {data.aiReply.delivery === "form" ? "" : data.aiReply.delivery === "email" ? ", by email instead" : " and goes by email"}.
            </p>
          )}
          {mode === "preview" && data.payment && (
            <p className="fk-live-note">
              On the live form, people go on to pay
              {data.payment.amount !== null
                ? ` ${data.payment.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${data.payment.currency.toUpperCase()}`
                : ` the amount from ${data.payment.fromCalc}`}{" "}
              through Stripe from here.
            </p>
          )}
          {redirectTo && (
            <p className="fk-live-note">
              {mode === "live"
                ? "Taking you on…"
                : `On the live form, people go straight to ${redirectTo} from here.`}
            </p>
          )}
          <div className="fk-live-foot" style={{ justifyContent: split ? "flex-start" : "center" }}>
            {t?.buttonLabel && t.buttonUrl && (
              <a href={t.buttonUrl} style={{ ...button(true), textDecoration: "none" }}>
                {t.buttonLabel}
              </a>
            )}
            {data.rules.editAfter && mode === "live" && (
              <a href={`/r/${done.token}`} style={{ ...button(false), textDecoration: "none" }}>
                Change your answers
              </a>
            )}
          </div>
        </div>
        {credit}
      </Shell>
    );
  }

  const intro = (
    <>
      <h1 style={{ textAlign: split ? undefined : "center" }}>
        {say(data.welcome?.title) || data.title}
      </h1>
      {data.welcome?.message && (
        <p className="fk-live-lede" style={{ textAlign: split ? undefined : "center" }}>
          {say(data.welcome.message)}
        </p>
      )}
    </>
  );

  /* ---------- a welcome page of its own ---------- */
  if (!started) {
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
        <div style={{ paddingTop: "4vh" }}>{intro}</div>
        <div className="fk-live-foot" style={{ justifyContent: split ? "flex-start" : "center" }}>
          <button
            type="button"
            style={button(true)}
            onClick={() => {
              setStarted(true);
              onStart?.();
              toTop();
            }}
          >
            {data.welcome?.button || "Start"}
          </button>
          <span style={{ fontSize: 13.5, opacity: 0.6 }}>
            {fields.length} {fields.length === 1 ? "question" : "questions"}
          </span>
        </div>
        {credit}
      </Shell>
    );
  }

  const trapField = data.rules.spam && (
    // A field no person sees; a script fills in everything it finds.
    <input
      className="fk-live-trap"
      tabIndex={-1}
      autoComplete="off"
      aria-hidden
      name="website"
      value={trap}
      onChange={(e) => setTrap(e.target.value)}
    />
  );

  const proveBox = prove && (
    <div className="fk-live-prove">
      <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={human} onChange={(e) => setHuman(e.target.checked)} />
        <span>I am a person, not a script</span>
      </label>
      <button type="button" style={button(true)} disabled={!human || busy} onClick={() => send(true)}>
        {busy ? "Sending…" : "Send"}
      </button>
    </div>
  );

  const failure = failed && <div className="fk-live-err" role="alert" style={{ marginTop: 18 }}>{failed}</div>;

  const question = (b: Block, big = false) => (
    <div key={b._id} className="fk-live-q" id={`q-${b._id}`} data-big={big ? "true" : undefined}>
      <div className="fk-live-q-title">
        {say(b.title)}
        {isRequired(b) && (
          <span className="fk-live-req" aria-hidden>
            *
          </span>
        )}
      </div>
      {b.help && <div className="fk-live-q-help">{say(b.help)}</div>}
      <div className="fk-live-q-control">
        <Control
          block={b}
          theme={theme}
          value={answers[b._id]}
          onChange={(a) => {
            setAnswers((prev) => ({ ...prev, [b._id]: a }));
            if (problem === b._id) setProblem(null);
          }}
          onFile={(file) => attach(b, file)}
          capMb={data.uploadCapMb}
          hiddenOptions={hiddenOptions.get(b._id)}
        />
      </div>
      {fileProblem[b._id] ? (
        <div className="fk-live-err">{fileProblem[b._id]}</div>
      ) : (
        problem === b._id && <div className="fk-live-err">This one is needed before you can go on.</div>
      )}
    </div>
  );

  const progress = (n: number, of: number) => (
    <div className="fk-live-progress" aria-hidden>
      <span style={{ width: `${of ? Math.round((n / of) * 100) : 0}%`, background: theme.primary }} />
    </div>
  );

  /* ---------- one question at a time ---------- */
  if (conversational) {
    if (!cur) {
      return (
        <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
          {intro}
          <p className="fk-live-note">There are no questions on this form yet.</p>
        </Shell>
      );
    }
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
        {step === 0 && !standalone && <div style={{ marginBottom: 28 }}>{intro}</div>}
        <div className="fk-live-steplabel">
          <span>
            {String(step + 1).padStart(2, "0")} / {String(fields.length).padStart(2, "0")}
          </span>
          {progress(step + 1, fields.length)}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            nextStep();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              nextStep();
            }
          }}
        >
          {trapField}
          {question(cur, true)}
          {failure}
          {proveBox}
          <div className="fk-live-foot fk-live-sticky" style={{ background: theme.bg }}>
            {step > 0 && (
              <button
                type="button"
                style={button(false)}
                onClick={() => {
                  setProblem(null);
                  setStep((s) => Math.max(0, s - 1));
                }}
              >
                <ArrowLeft size={17} strokeWidth={1.9} aria-hidden /> Back
              </button>
            )}
            <button type="submit" style={button(true)} disabled={busy || thinking}>
              {thinking ? "One moment…" : busy ? "Sending…" : lastStep ? "Submit" : "OK"}
            </button>
            {!lastStep && (
              <span className="fk-live-hint">
                press Enter <CornerDownLeft size={14} strokeWidth={1.9} aria-hidden />
              </span>
            )}
          </div>
        </form>
        {credit}
      </Shell>
    );
  }

  /* ---------- classic: a page of questions at a time ---------- */
  return (
    <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
      {page === 0 && !standalone && intro}
      {live.length > 1 && (
        <div style={{ marginTop: page === 0 && !standalone ? 34 : 0 }}>
          <div className="fk-live-steplabel">
            <span>
              Page {page + 1} of {live.length}
            </span>
            {progress(page + 1, live.length)}
          </div>
          {current?.name && <h2 className="fk-live-pagetitle">{say(current.name)}</h2>}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          nextPage();
        }}
      >
        {trapField}
        <div style={{ marginTop: 10 }}>{(current?.fields ?? []).map((b) => question(b))}</div>
        {!fields.length && <p className="fk-live-note">There are no questions on this form yet.</p>}
        {failure}
        {proveBox}
        <div className="fk-live-foot">
          {page > 0 && (
            <button
              type="button"
              style={button(false)}
              onClick={() => {
                setPage((p) => p - 1);
                toTop();
              }}
            >
              Back
            </button>
          )}
          <button type="submit" style={button(true)} disabled={busy || thinking || !fields.length}>
            {thinking ? "One moment…" : busy ? "Sending…" : lastPage ? (resume?.editing ? "Save changes" : "Submit") : "Next"}
          </button>
          <span style={{ fontSize: 13.5, opacity: 0.6 }}>
            {answeredCount} of {fields.length} answered
          </span>
        </div>
      </form>
      {credit}
    </Shell>
  );
}

/* ---------- the shell the form is painted into ---------- */

export function Shell({
  theme,
  brand,
  logos,
  custom,
  children,
}: {
  theme: ReturnType<typeof themeOf> | null;
  brand?: { name: string; logoUrl: string | null; color: string | null };
  logos?: { name: string; url: string | null }[];
  custom?: OpenForm["custom"];
  children: React.ReactNode;
}) {
  const t = theme ?? themeOf(null);
  const brandFont = custom?.font ? `${custom.font.name.replace(/["\\]/g, "")} Formkit brand` : null;
  const css = cleanCss(custom?.css);
  useEffect(() => {
    loadFont(t.font);
    loadFont(t.heading);
  }, [t.font, t.heading]);
  const split = t.layout === "split";
  return (
    <div
      className="fk-live"
      data-layout={t.layout}
      data-custom={css ? "true" : undefined}
      style={
        {
          background: t.bg,
          color: t.text,
          fontSize: 16 * SIZE_SCALE[t.size],
          fontFamily: brandFont ? `"${brandFont}", ${fontStack(t.font)}` : fontStack(t.font),
          "--fk-live-heading": brandFont ? `"${brandFont}", ${fontStack(t.heading)}` : fontStack(t.heading),
          "--fk-live-weight": WEIGHTS[t.weight],
        } as React.CSSProperties
      }
    >
      {brandFont && custom?.font && (
        <style>{`@font-face{font-family:"${brandFont}";src:url("${encodeURI(custom.font.url)}");font-display:swap}`}</style>
      )}
      {css && <style>{`.fk-live[data-custom="true"]{${css}}`}</style>}
      <div className="fk-live-inner">
        {brand && t.showLogo && (
          <div className="fk-live-brand">
            <LogoLockup
              lead={{ name: brand.name, logoUrl: brand.logoUrl }}
              extras={logos ?? []}
              align={split ? "left" : t.logoAlign}
              size={LOGO_PX[t.logoSize]}
            />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ---------- one answer control ---------- */

function Control({
  block,
  theme,
  value,
  onChange,
  onFile,
  capMb = 10,
  hiddenOptions,
}: {
  block: Block;
  theme: ReturnType<typeof themeOf>;
  value?: Answer;
  onChange: (a: Answer) => void;
  onFile: (file: File) => void;
  capMb?: number;
  /** Options a logic rule hides right now. */
  hiddenOptions?: Set<string>;
}) {
  const radius = Math.min(theme.radius, 24);
  // The options on offer: minus any a rule hides, each with its places left.
  const offered = (block.options ?? [])
    .map((o, i) => ({ o, left: block.left?.[i] ?? null }))
    .filter((x) => !hiddenOptions?.has(x.o));
  const placeNote = (left: number | null) =>
    left === null ? null : left <= 0 ? "Full" : left === 1 ? "1 place left" : `${left} places left`;
  const box: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    border: "none",
    borderRadius: radius,
    background: theme.surface === theme.bg ? "rgba(0,0,0,.05)" : theme.surface,
    color: "inherit",
    font: "inherit",
    fontSize: "1em",
    outline: "none",
    boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
  };

  switch (block.type) {
    case "address":
      return (
        <textarea
          rows={3}
          style={{ ...box, resize: "vertical" }}
          autoComplete="street-address"
          placeholder={block.placeholder ?? ""}
          value={value?.value ?? ""}
          aria-label={block.title ?? "Address"}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      );

    case "long-text":
      return (
        <textarea
          rows={4}
          style={{ ...box, resize: "vertical" }}
          placeholder={block.placeholder ?? ""}
          value={value?.value ?? ""}
          aria-label={block.title ?? "Answer"}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      );

    case "single-choice":
    case "yes-no": {
      const options =
        block.type === "yes-no"
          ? ["Yes", "No"].filter((o) => !hiddenOptions?.has(o)).map((o) => ({ o, left: null as number | null }))
          : offered;
      return (
        <div className="fk-live-choices">
          {options.map(({ o, left }) => (
            <button
              key={o}
              type="button"
              className="fk-live-choice"
              data-picked={value?.value === o ? "true" : undefined}
              data-full={left !== null && left <= 0 ? "true" : undefined}
              disabled={left !== null && left <= 0}
              style={{ borderRadius: radius }}
              onClick={() => onChange({ value: o })}
            >
              {o}
              {placeNote(left) && <span className="fk-live-places">{placeNote(left)}</span>}
            </button>
          ))}
        </div>
      );
    }

    case "multi-choice": {
      const picked = value?.values ?? [];
      return (
        <div className="fk-live-choices">
          {offered.map(({ o, left }) => (
            <button
              key={o}
              type="button"
              className="fk-live-choice"
              data-picked={picked.includes(o) ? "true" : undefined}
              data-full={left !== null && left <= 0 && !picked.includes(o) ? "true" : undefined}
              disabled={left !== null && left <= 0 && !picked.includes(o)}
              style={{ borderRadius: radius }}
              onClick={() =>
                onChange({
                  values: picked.includes(o) ? picked.filter((p) => p !== o) : [...picked, o],
                })
              }
            >
              {o}
              {placeNote(left) && <span className="fk-live-places">{placeNote(left)}</span>}
            </button>
          ))}
        </div>
      );
    }

    case "dropdown":
      return (
        <select
          style={box}
          value={value?.value ?? ""}
          aria-label={block.title ?? "Answer"}
          onChange={(e) => onChange({ value: e.target.value })}
        >
          <option value="">Choose one</option>
          {offered.map(({ o, left }) => (
            <option key={o} value={o} disabled={left !== null && left <= 0}>
              {placeNote(left) ? `${o} — ${placeNote(left)}` : o}
            </option>
          ))}
        </select>
      );

    case "rating": {
      const max = block.scaleMax ?? 5;
      return (
        <div className="fk-live-scale">
          {Array.from({ length: max }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1} out of ${max}`}
              data-picked={Number(value?.value) >= i + 1 ? "true" : undefined}
              onClick={() => onChange({ value: String(i + 1) })}
            >
              <span>★</span>
            </button>
          ))}
        </div>
      );
    }

    case "scale": {
      const from = block.scaleMin ?? 1;
      const to = block.scaleMax ?? 5;
      return (
        <div className="fk-live-scale">
          {Array.from({ length: Math.max(0, to - from + 1) }).map((_, i) => {
            const n = from + i;
            return (
              <button
                key={n}
                type="button"
                data-picked={value?.value === String(n) ? "true" : undefined}
                onClick={() => onChange({ value: String(n) })}
              >
                <span>{n}</span>
              </button>
            );
          })}
        </div>
      );
    }

    case "file":
      return (
        <label
          style={{
            ...box,
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
          }}
        >
          <Paperclip size={16} strokeWidth={1.8} aria-hidden />
          <span style={{ flex: 1, minWidth: 0 }}>
            {value?.fileName ??
              (block.accept?.length
                ? `Choose a ${block.accept.join(" ")} file — up to ${capMb} MB`
                : `Choose a file — up to ${capMb} MB`)}
          </span>
          <input
            type="file"
            accept={block.accept?.length ? block.accept.join(",") : undefined}
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </label>
      );

    case "signature":
      return (
        <input
          style={{ ...box, fontSize: "1.3em" }}
          placeholder="Type your full name"
          value={value?.value ?? ""}
          aria-label={block.title ?? "Signature"}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      );

    default:
      return (
        <input
          style={box}
          type={
            block.type === "email"
              ? "email"
              : block.type === "number"
                ? "number"
                : block.type === "date"
                  ? "date"
                  : block.type === "time"
                    ? "time"
                    : block.type === "phone"
                      ? "tel"
                      : block.type === "url"
                        ? "url"
                        : "text"
          }
          autoComplete={
            block.type === "name"
              ? "name"
              : block.type === "company"
                ? "organization"
                : block.type === "email"
                  ? "email"
                  : block.type === "phone"
                    ? "tel"
                    : undefined
          }
          placeholder={block.placeholder ?? ""}
          value={value?.value ?? ""}
          aria-label={block.title ?? "Answer"}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      );
  }
}

/** Enough to tell a phone from a laptop, and nothing more. */
export function describeDevice() {
  if (typeof navigator === "undefined") return undefined;
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Phone";
  return "Desktop";
}


/**
 * Answers a link carries (Pro): ?budget=5000 fills the question keyed
 * "budget", and a hidden field takes its value from the link or its default.
 * A choice only takes a value that is one of its options.
 */
function prefilled(blocks: Block[], allowed: boolean): Record<string, Answer> {
  if (!allowed || typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, Answer> = {};
  for (const b of blocks) {
    if (b.kind !== "field" || !b.key) continue;
    const raw = params.get(b.key);
    if (b.type === "hidden") {
      const value = (raw ?? b.defaultValue ?? "").slice(0, 500);
      if (value) out[b._id] = { value };
      continue;
    }
    if (!raw) continue;
    const options = b.type === "yes-no" ? ["Yes", "No"] : (b.options ?? []);
    const match = (v: string) => options.find((o) => o.toLowerCase() === v.trim().toLowerCase());
    if (b.type === "multi-choice") {
      const values = raw.split(",").map(match).filter((v): v is string => !!v);
      if (values.length) out[b._id] = { values };
    } else if (["single-choice", "dropdown", "yes-no"].includes(b.type ?? "")) {
      const v = match(raw);
      if (v) out[b._id] = { value: v };
    } else if (b.type !== "file" && b.type !== "signature") {
      out[b._id] = { value: raw.slice(0, 2000) };
    }
  }
  return out;
}
