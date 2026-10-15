"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { SignaturePad } from "./SignaturePad";
import { MatrixControl, RankingControl } from "./GridControls";
import { LANG_NAMES, LangContext, RTL, isLang, localize, pickLang, tr, useT, type Lang, type Translation } from "./i18n";
import { VoiceRecorder } from "./VoiceRecorder";
import { voiceLength } from "../../../convex/model/voice";
import { ArrowLeft, Check, Clock3, CornerDownLeft, CreditCard, Lock, Paperclip, Sparkles } from "lucide-react";
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
import { QuizResult } from "./QuizResult";
import { applyLogic, conditionsOf, type Rule as LogicRule } from "../../../convex/model/logicEval";
import { endingOf, nextPage as jumpNext, type JumpPage } from "../../../convex/model/jumps";
import { ruleProblem } from "../../../convex/model/validate";
import { videoEmbed } from "../../../convex/model/video";
import { LogoLockup } from "./LogoLockup";
import { Logo } from "@/components/brand/Logo";

/**
 * The form, as somebody answering it sees it - on the public link, and in the
 * builder's preview, which runs this same component.
 *
 * Things that matter here and are easy to get wrong:
 *  - Leaving keeps what was answered. The partial is saved on the way out and
 *    carries a token, so the owner can send the person back to it.
 *  - Logic is evaluated on every answer, and a hidden question is never
 *    required - otherwise a form can become impossible to finish.
 *  - Required means required: the page will not advance, and the message says
 *    which question is waiting.
 *  - Classic puts a page of questions on screen; conversational asks one at a
 *    time, with Enter to go on and the submit button always in reach.
 */

export type Block = {
  _id: Id<"blocks">;
  kind: "field" | "pagebreak" | "content";
  type: string | null;
  title: string | null;
  help: string | null;
  placeholder: string | null;
  required: boolean;
  options: string[] | null;
  /** A matrix's rows; its options are the columns. */
  rows?: string[] | null;
  /** In another language: what to show for each option and row (answers keep the form's own). */
  optionLabels?: string[] | null;
  rowLabels?: string[] | null;
  /** A matrix where a row can take several columns. */
  matrixMulti?: boolean | null;
  accept: string[] | null;
  scaleMin: number | null;
  scaleMax: number | null;
  /** Voice recording: the longest recording allowed, in seconds. */
  maxSeconds?: number | null;
  pageName: string | null;
  /** Pro: pre-fill, piping and formulas read a question by its key. */
  key?: string | null;
  scores?: number[] | null;
  defaultValue?: string | null;
  /** Pro: places left per option; null where an option has no limit. */
  left?: (number | null)[] | null;
  /** Pro: a hidden field AI fills from another answer. */
  extract?: { from: Id<"blocks"> } | null;
  /** Quiz: what the question is worth, when it counts. */
  marks?: number | null;
  /** Words at either end of a scale. */
  scaleLabels?: { start?: string; end?: string } | null;
  /** Choices: an "Other" option with its own words. */
  allowOther?: boolean;
  /** Limits the answer is held to (model/validate.ts says the same on the server). */
  validation?: Validation | null;
  /** Pro: the AI may ask one follow-up question to this written answer. */
  followUp?: boolean | null;
  /** Content blocks: a picture (and its description) or a video link. */
  imageUrl?: string | null;
  alt?: string | null;
  videoUrl?: string | null;
};

export type Validation = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string;
  minDate?: string;
  maxDate?: string;
  minPicks?: number;
  maxPicks?: number;
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

export type Answer = {
  value?: string;
  values?: string[];
  fileId?: Id<"_storage">;
  fileName?: string;
  /** The AI's follow-up to this answer, and what the person said to it. */
  followUp?: { question: string; answer: string };
};

/** Pro: the quiz settings the form itself needs. */
export type QuizSettings = {
  timeLimit: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  results: "instant" | "later";
  passMark: number | null;
  oneAttempt: boolean;
};

export type OpenForm = {
  /** The form's language, and (Pro) its translations into others. */
  language?: string;
  translations?: Translation[];
  quiz?: QuizSettings | null;
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
  /** Pro: people pay through the owner's Stripe, and the answers are sent once they have. */
  payment?: {
    label: string | null;
    currency: string;
    amount: number | null;
    fromCalc: string | null;
    /** Pay what you want, at least `minimum`. */
    choose?: { minimum: number; suggested: number | null } | null;
    quantityAtCheckout?: number | null;
  } | null;
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
  /** Quiz: the attempt the timer belongs to, and whether time ran out. */
  attemptId?: Id<"quizAttempts">;
  timedOut?: boolean;
  answers: ({ blockId: Id<"blocks"> } & Answer)[];
};

/** An amount as the person's browser writes money. */
function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/** The same list in an order fixed by the seed: each person's own, but steady. */
function shuffled<T>(list: T[], seed: number, key: (x: T) => string): T[] {
  const hash = (s: string) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 2654435761) >>> 0;
    return h;
  };
  return [...list].sort((a, b) => hash(key(a)) - hash(key(b)));
}

/** Clock reads live out here, where they are not part of a render. */
const now = () => Date.now();
const since = (from: number) => (from ? now() - from : undefined);

const filled = (a?: Answer) => !!(a?.value?.trim() || a?.values?.length || a?.fileId);

type RunnerProps = Parameters<typeof FormRunnerInner>[0];

/**
 * The live form in the right language: the link's ?lang=, the visitor's
 * browser, or the form's own, among those it is offered in. Its words and
 * (Pro) its questions follow; a switcher shows when there is a choice.
 */
export function FormRunner(props: RunnerProps) {
  const base: Lang = isLang(props.data.language) ? props.data.language : "en";
  const offered = useMemo(
    () => [base, ...(props.data.translations ?? []).map((t) => t.lang).filter((l): l is Lang => isLang(l) && l !== base)],
    [base, props.data.translations],
  );
  const [chosen, setChosen] = useState<Lang | null>(null);
  const lang: Lang =
    chosen && offered.includes(chosen)
      ? chosen
      : typeof window === "undefined"
        ? base
        : pickLang(offered, base, new URLSearchParams(window.location.search).get("lang"), navigator.languages ?? [navigator.language]);
  const data = useMemo(
    () => (lang === base ? props.data : localize(props.data, props.data.translations?.find((t) => t.lang === lang))),
    [lang, base, props.data],
  );
  return (
    <LangContext.Provider value={lang}>
      <div dir={RTL.has(lang) ? "rtl" : undefined} lang={lang}>
        {offered.length > 1 && (
          <label className="fk-live-lang">
            <span className="sr-only">{tr(lang, "language")}</span>
            <select value={lang} onChange={(e) => setChosen(e.target.value as Lang)}>
              {offered.map((l) => (
                <option key={l} value={l}>
                  {LANG_NAMES[l]}
                </option>
              ))}
            </select>
          </label>
        )}
        <FormRunnerInner {...props} data={data} />
      </div>
    </LangContext.Provider>
  );
}

function FormRunnerInner({
  data,
  mode,
  closed = false,
  resume,
  onSubmit,
  onFollowUp,
  onSaveForLater,
  onPay,
  onPayFirst,
  onStart,
  onThink,
  onStartQuiz,
  upload,
  scrollRoot,
}: {
  data: OpenForm;
  mode: "live" | "preview";
  /** Show the closed screen instead of the questions. */
  closed?: boolean;
  /** Answers already given - a partial being finished, or a response being changed. */
  resume?: { token: string; answers: Record<string, Answer>; editing: boolean };
  onSubmit: (args: SubmitArgs) => Promise<Submitted>;
  /** Pro: the follow-up question to a written answer, or null. The live form only. */
  onFollowUp?: (blockId: string, answer: string) => Promise<string | null>;
  /** "Save and finish later": emails the person their link back. The live form only. */
  onSaveForLater?: (email: string, resumeToken: string) => Promise<void>;
  /** Opens the payment page for a response that owes one; the live form only. */
  onPay?: (r: { responseId: Id<"responses">; resumeToken: string }) => Promise<{ url: string } | { paid: true } | null>;
  /** Pay first: holds the answers and opens Stripe, or keeps them at once when nothing is owed. The live form only. */
  onPayFirst?: (
    args: SubmitArgs & { chosen?: number },
  ) => Promise<{ url: string; holdId: string } | { responseId: Id<"responses">; resumeToken: string }>;
  onStart?: () => void;
  /** Pro: starts a quiz attempt on the server, which keeps its clock. The live form only. */
  onStartQuiz?: () => Promise<{ attemptId: Id<"quizAttempts">; startedAt: number; endsAt: number | null }>;
  /** Pro: asks the AI about answers when a page is finished. The live form only. */
  onThink?: (a: {
    checks: string[];
    facts: string[];
    answers: { blockId: string; text: string }[];
  }) => Promise<{ judged: Record<string, boolean>; extracted: Record<string, string> }>;
  upload: (file: File) => Promise<Id<"_storage">>;
  /** What scrolls - the window, or the preview's own frame. */
  scrollRoot?: RefObject<HTMLElement | null>;
}) {
  const tx = useT();
  const theme = themeOf(data.theme);
  const scale = SIZE_SCALE[theme.size];
  const ink = buttonInk(theme.primary);
  const blocks = data.blocks;
  const conversational = theme.flow === "conversational";
  const standalone = blocks[0]?.kind === "pagebreak";

  const [started, setStarted] = useState(!!resume || !standalone);
  const [page, setPage] = useState(0);
  const [step, setStep] = useState(0);
  const [trail, setTrail] = useState<number[]>([]);
  // Pay first: what the person chose to pay, and the moment they are sent to Stripe.
  const payFirst = mode === "live" && !!onPayFirst && !!data.payment && !resume?.editing;
  const [chosen, setChosen] = useState(() => String(data.payment?.choose?.suggested ?? data.payment?.choose?.minimum ?? ""));
  const [toStripe, setToStripe] = useState(false);
  const rounds = useRef<Record<string, number>>({});
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
  // "Save and finish later": the panel, the address, and how sending it went.
  const [later, setLater] = useState<{ open: boolean; email: string; state: "idle" | "sending" | "sent"; error?: string }>({
    open: false,
    email: "",
    state: "idle",
  });
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
  // Pro: what the AI said about answers, by condition id, once asked.
  const [judged, setJudged] = useState<Record<string, boolean>>({});
  const [thinking, setThinking] = useState(false);
  // Follow-ups: each written answer is looked at once, and at most two are asked.
  const followUpsAsked = useRef(new Set<string>());
  const followUpsShown = useRef(0);
  // The answer each AI condition or hidden field was last asked about.
  const askedWith = useRef<Record<string, string>>({});

  /* ---------- quiz: attempt, clock and shuffling (Pro) ---------- */
  const quiz = data.quiz ?? null;
  const [attempt, setAttempt] = useState<{ attemptId?: Id<"quizAttempts">; endsAt: number | null } | null>(null);
  const [quizBlocked, setQuizBlocked] = useState<string | null>(null);
  const [clock, setClock] = useState(() => now());
  // One order per person, kept for the whole attempt.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const types = useMemo(() => Object.fromEntries(blocks.map((b) => [b._id as string, b.type])), [blocks]);
  const outcome = useMemo(
    () => applyLogic(data.logic, { answers, calc: results, ai: judged, types }),
    [answers, data.logic, results, judged, types],
  );
  const { hidden, forced, hiddenOptions } = outcome;
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

  // A quiz with a timer or one attempt starts an attempt once the person starts.
  const timeUp = useRef<() => void>(() => {});
  useEffect(() => {
    if (!quiz || !started || attempt || done || resume || !(quiz.timeLimit || quiz.oneAttempt)) return;
    let live = true;
    const begin = async () => {
      if (mode !== "live" || !onStartQuiz) {
        if (live) setAttempt({ endsAt: quiz.timeLimit ? now() + quiz.timeLimit * 60_000 : null });
        return;
      }
      try {
        const a = await onStartQuiz();
        if (live) setAttempt({ attemptId: a.attemptId, endsAt: a.endsAt });
      } catch (e) {
        const d = (e as { data?: unknown }).data;
        if (live) setQuizBlocked(typeof d === "string" ? d : "This quiz can’t be started right now.");
      }
    };
    void begin();
    return () => {
      live = false;
    };
  }, [quiz, started, attempt, done, resume, mode, onStartQuiz]);
  // The clock ticks while the quiz is open; at zero it sends itself.
  useEffect(() => {
    const endsAt = attempt?.endsAt;
    if (!endsAt || done) return;
    const t = window.setInterval(() => {
      setClock(now());
      if (now() >= endsAt) {
        window.clearInterval(t);
        timeUp.current();
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [attempt?.endsAt, done]);

  /* ---------- pages, and the questions in order ---------- */
  const pagesFor = (gone: Set<string>) => {
    const pages: { name: string; fields: Block[]; anchors: string[] }[] = [{ name: "", fields: [], anchors: [] }];
    for (const b of blocks) {
      if (b.kind === "pagebreak") pages.push({ name: b.pageName ?? "", fields: [], anchors: [b._id] });
      else {
        const last = pages[pages.length - 1]!;
        last.anchors.push(b._id);
        if (b.type !== "hidden" && !gone.has(b._id)) last.fields.push(b);
      }
    }
    if (quiz?.shuffleQuestions) for (const p of pages) p.fields = shuffled(p.fields, seed, (b) => b._id);
    // A page with nothing to show is skipped; a jump to it lands on the next one that has something.
    const out: typeof pages = [];
    let carry: string[] = [];
    for (const p of pages) {
      if (!p.fields.length) carry = [...carry, ...p.anchors];
      else {
        out.push({ ...p, anchors: [...carry, ...p.anchors] });
        carry = [];
      }
    }
    return out;
  };
  /** One question to a page, for one-at-a-time forms: hidden blocks and page breaks lead to the page's first question. */
  const stepsOf = (pages: ReturnType<typeof pagesFor>) =>
    pages.flatMap((p) =>
      p.fields.map((f, i) => ({ anchors: i === 0 ? p.anchors.filter((id) => id === f._id || !p.fields.some((x) => x._id === id)) : [f._id] })),
    );
  const live = pagesFor(hidden);
  const fields = live.flatMap((p) => p.fields);
  const current = live[Math.min(page, Math.max(0, live.length - 1))];
  const lastPage = page >= live.length - 1;
  const cur = fields[Math.min(step, Math.max(0, fields.length - 1))];
  const lastStep = step >= fields.length - 1;
  // Content blocks are shown, not answered: they never count as questions.
  const questions = fields.filter((b) => b.kind !== "content");
  const answeredCount = questions.filter((b) => filled(kept[b._id])).length;

  function isRequired(b: Block) {
    // A hidden question is never required, or the form cannot be finished.
    if (hidden.has(b._id) || b.kind === "content") return false;
    if (b.required || forced.has(b._id)) return true;
    return data.rules.requireEmail && b.type === "email";
  }
  const firstMissing = (list: Block[]) => list.find((b) => isRequired(b) && !filled(kept[b._id]));
  // A question's own rules (range, length, pattern, dates, picks): the same
  // check the server makes (model/validate.ts).
  const [ruleErrors, setRuleErrors] = useState<Record<string, string>>({});
  function stopsOnRule(list: Block[]) {
    for (const b of list) {
      if (hidden.has(b._id) || b.kind === "content") continue;
      // A required matrix wants every row, as the server does.
      const rowsLeft =
        b.type === "matrix" && isRequired(b) && kept[b._id]?.values?.length
          ? (b.rows ?? []).filter((r) => !kept[b._id]!.values!.some((v) => v.startsWith(`${r}: `))).length
          : 0;
      const message = rowsLeft ? tx("everyRow", { n: rowsLeft }) : ruleProblem(b as never, kept[b._id]);
      if (message) {
        setRuleErrors({ [b._id]: message });
        focusQuestion(b._id);
        return b;
      }
    }
    setRuleErrors({});
    return null;
  }

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

  // A redirect after submitting, on the live form only - with {{keys}} filled in.
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

  async function send(
    asHuman = human,
    over?: { answers?: Record<string, Answer>; ending?: string | null; timedOut?: boolean },
  ) {
    const sending = over?.answers ?? kept;
    const ending = over && "ending" in over ? over.ending : outcome.ending;
    const choose = payFirst ? data.payment?.choose : null;
    if (choose && !(Number(chosen) >= choose.minimum)) {
      setFailed(tx("atLeast", { amount: money(choose.minimum, data.payment!.currency) }));
      return;
    }
    setBusy(true);
    setFailed(null);
    try {
      savedPartial.current = true;
      const submit = payFirst
        ? async (args: SubmitArgs): Promise<Submitted> => {
            const r = await onPayFirst!({ ...args, ...(choose ? { chosen: Number(chosen) } : {}) });
            if ("url" in r) {
              try {
                window.sessionStorage.setItem("fk.pay", JSON.stringify({ holdId: r.holdId }));
              } catch {
                /* Coming back to try again just will not be offered. */
              }
              setToStripe(true);
              window.location.assign(r.url);
              throw new Error("leaving");
            }
            return { responseId: r.responseId, resumeToken: r.resumeToken };
          }
        : onSubmit;
      const r = await submit({
        partial: false,
        human: asHuman || undefined,
        trap: trap || undefined,
        device: describeDevice(),
        durationMs: since(openedAt.current),
        ending: ending ?? undefined,
        attemptId: attempt?.attemptId,
        timedOut: over?.timedOut || undefined,
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
      // On the way to Stripe: nothing went wrong.
      if (e instanceof Error && e.message === "leaving") return;
      savedPartial.current = false;
      const data = (e as { data?: unknown }).data;
      if (data && typeof data === "object" && (data as { code?: string }).code === "prove") {
        setProve(true);
      } else if (data && typeof data === "object" && (data as { code?: string }).code === "invalid") {
        // The server found an answer the form does not allow: point at it.
        const bad = data as { message?: string; blockId?: string | null };
        setFailed(bad.message || tx("checkAgain"));
        if (bad.blockId) {
          setProblem(bad.blockId);
          focusQuestion(bad.blockId);
          document.getElementById(`q-${bad.blockId}`)?.scrollIntoView({ block: "center" });
        }
      } else {
        const msg = typeof data === "string" ? data : e instanceof Error ? e.message : "";
        setFailed(msg || tx("notSent"));
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
   * Pro: asks the AI about the answers just given - its yes-or-no
   * conditions and the hidden fields it fills - and works the rules out
   * again with what it said. Never holds anyone up for long: after a few
   * seconds, or on any failure, the form goes on with the fallbacks.
   */
  /**
   * Before moving on: may the AI ask one follow-up to a written answer here?
   * Shows it under that answer and stays put; the person can answer it or
   * just carry on, since it is never required.
   */
  async function askFollowUp(list: Block[]) {
    if (!onFollowUp || mode !== "live" || followUpsShown.current >= 2) return false;
    for (const b of list) {
      if (!b.followUp || hidden.has(b._id) || followUpsAsked.current.has(b._id)) continue;
      const text = kept[b._id]?.value?.trim();
      if (!text) continue;
      followUpsAsked.current.add(b._id);
      setThinking(true);
      const question = await onFollowUp(b._id, text).catch(() => null);
      setThinking(false);
      if (!question) continue;
      followUpsShown.current += 1;
      setAnswers((prev) => ({ ...prev, [b._id]: { ...prev[b._id], followUp: { question, answer: "" } } }));
      window.setTimeout(() => document.getElementById(`q-${b._id}-followup`)?.focus(), 50);
      return true;
    }
    return false;
  }

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

  useEffect(() => {
    timeUp.current = () => {
      if (!done && !busy) void send(human, { timedOut: true });
    };
  });

  /** Where Next goes, counting the rounds of any jump back. */
  function nextMove(list: JumpPage[], at: number, jumps: LogicRule[]) {
    const move = jumpNext(list, at, jumps, rounds.current);
    if (move.back) rounds.current[move.back] = (rounds.current[move.back] ?? 0) + 1;
    return move;
  }
  /** Back retraces the pages actually visited, jumps and all. */
  function goBack() {
    const prev = trail.length ? trail[trail.length - 1]! : (conversational ? step : page) - 1;
    setTrail((t) => t.slice(0, -1));
    if (conversational) {
      setProblem(null);
      setStep(Math.max(0, prev));
    }
    else {
      setPage(Math.max(0, prev));
      toTop();
    }
  }

  async function nextPage() {
    const missing = firstMissing(current?.fields ?? []);
    if (missing) {
      setProblem(missing._id);
      focusQuestion(missing._id);
      document.getElementById(`q-${missing._id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    setProblem(null);
    if (stopsOnRule(current?.fields ?? [])) return;
    if (await askFollowUp(current?.fields ?? [])) return;
    const now = await think(current?.fields ?? []);
    const move = nextMove(pagesFor(now.outcome.hidden), page, now.outcome.jumps);
    if (move.finish !== undefined) return void send(human, { answers: now.answers, ending: endingOf(move.finish) ?? null });
    if (!lastPage || move.back) {
      setTrail((t) => [...t, page]);
      setPage(move.to);
      toTop();
      return;
    }
    void send(human, { answers: now.answers, ending: now.outcome.ending });
  }

  async function nextStep() {
    if (!cur) return;
    if (isRequired(cur) && !filled(kept[cur._id])) {
      setProblem(cur._id);
      focusQuestion(cur._id);
      return;
    }
    setProblem(null);
    if (stopsOnRule([cur])) return;
    if (await askFollowUp([cur])) return;
    const now = await think([cur]);
    const move = nextMove(stepsOf(pagesFor(now.outcome.hidden)), step, now.outcome.jumps);
    if (move.finish !== undefined) return void send(human, { answers: now.answers, ending: endingOf(move.finish) ?? null });
    if (!lastStep || move.back) {
      setTrail((t) => [...t, step]);
      setStep(move.to);
      return;
    }
    const missing = firstMissing(fields);
    if (missing) {
      setStep(fields.indexOf(missing));
      setProblem(missing._id);
      focusQuestion(missing._id);
      return;
    }
    const broken = stopsOnRule(fields);
    if (broken) {
      setStep(fields.indexOf(broken));
      return;
    }
    void send(human, { answers: now.answers, ending: now.outcome.ending });
  }

  async function attach(block: Block, file: File) {
    if (file.size > data.uploadCapMb * 1024 * 1024) {
      setFileProblem((p) => ({ ...p, [block._id]: tx("fileOver", { mb: data.uploadCapMb }) }));
      return;
    }
    const allowed = block.accept ?? [];
    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (allowed.length && !allowed.includes(ext)) {
      setFileProblem((p) => ({
        ...p,
        [block._id]: tx("fileTypes", { types: allowed.join(" ") }),
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
      // A signature keeps the name typed beside it.
      setAnswers((a) => ({
        ...a,
        [block._id]: { ...(block.type === "signature" ? { value: a[block._id]?.value } : {}), fileId, fileName: file.name },
      }));
    } catch {
      setFileProblem((p) => ({ ...p, [block._id]: tx("uploadFailed") }));
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

  const credit =
    data.brand.badge === false ? null : (
      <a className="fk-live-credit" href="https://formkit.app" target="_blank" rel="noopener" aria-label="Made with Formkit">
        <Logo size={20} tone="current" />
      </a>
    );
  const split = theme.layout === "split";

  /* ---------- closed ---------- */
  if (closed) {
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
        <div style={{ paddingTop: "8vh", textAlign: "center" }}>
          <span className="fk-live-lock">
            <Lock size={30} strokeWidth={1.8} aria-hidden />
          </span>
          <h1 style={{ marginTop: 22 }}>{tx("closed")}</h1>
          <p className="fk-live-lede">{data.closedMessage}</p>
        </div>
      </Shell>
    );
  }

  /* ---------- sent ---------- */
  if (toStripe) {
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
        <div style={{ textAlign: split ? "left" : "center", paddingTop: "4vh" }}>
          <span className="fk-live-lock" style={{ background: theme.primary, color: ink }}>
            <CreditCard size={30} strokeWidth={1.8} aria-hidden />
          </span>
          <h1 style={{ marginTop: 22 }}>{tx("toPayment")}</h1>
          <p className="fk-live-lede">{tx("payFirstNote")}</p>
        </div>
        {credit}
      </Shell>
    );
  }
  if (done?.paying) {
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
        <div style={{ textAlign: split ? "left" : "center", paddingTop: "4vh" }}>
          <span className="fk-live-lock" style={{ background: theme.primary, color: ink }}>
            <CreditCard size={30} strokeWidth={1.8} aria-hidden />
          </span>
          <h1 style={{ marginTop: 22 }}>{payProblem ? tx("oneMoreStep") : tx("toPayment")}</h1>
          <p className="fk-live-lede">
            {payProblem ?? tx("paymentNote")}
          </p>
          {payProblem && (
            <div className="fk-live-foot" style={{ justifyContent: split ? "flex-start" : "center" }}>
              <button type="button" style={button(true)} onClick={() => void goPay(done.responseId!, done.token)}>
                {tx("tryAgain")}
              </button>
            </div>
          )}
        </div>
        {credit}
      </Shell>
    );
  }

  if (quizBlocked) {
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
        <div style={{ textAlign: "center", paddingTop: "8vh" }}>
          <h1>{data.title}</h1>
          <p className="fk-live-lede">{quizBlocked}</p>
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
          <h1 style={{ marginTop: 22 }}>{say(t?.title) || tx("thankYou")}</h1>
          <p className="fk-live-lede">{say(t?.message) || "Your answers are in."}</p>
          {quiz && mode === "live" && <QuizResult token={done.token} />}
          {quiz && mode === "preview" && (
            <p className="fk-live-note">
              On the live form, {quiz.results === "instant" ? "their mark shows here straight away" : "people are told their results come later"}.
            </p>
          )}
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
            {data.rules.editAfter && mode === "live" && !quiz && (
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
            {data.welcome?.button || tx("start")}
          </button>
          <span style={{ fontSize: 13.5, opacity: 0.75 }}>
            {questions.length} {questions.length === 1 ? "question" : "questions"}
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
        <span>{tx("person")}</span>
      </label>
      <button type="button" style={button(true)} disabled={!human || busy} onClick={() => send(true)}>
        {busy ? tx("sending") : tx("send")}
      </button>
    </div>
  );

  /* ---------- save and finish later ---------- */
  async function saveForLater() {
    if (!onSaveForLater) return;
    setLater((l) => ({ ...l, state: "sending", error: undefined }));
    try {
      const r = await onSubmit({
        partial: true,
        device: describeDevice(),
        durationMs: since(openedAt.current),
        answers: Object.entries(kept)
          .filter(([id]) => fields.some((f) => f._id === id) || hiddenFields.some((f) => f._id === id))
          .map(([blockId, a]) => ({ blockId: blockId as Id<"blocks">, ...a })),
      });
      await onSaveForLater(later.email, r.resumeToken);
      setLater((l) => ({ ...l, state: "sent" }));
    } catch (e) {
      const d = (e as { data?: unknown }).data;
      setLater((l) => ({ ...l, state: "idle", error: typeof d === "string" ? d : tx("notSent") }));
    }
  }
  const emailAnswer = fields.find((b) => b.type === "email" && kept[b._id]?.value)?._id;
  const laterBox =
    onSaveForLater && mode === "live" && !resume?.editing && answeredCount > 0 && !quiz ? (
      <div className="fk-live-later">
        {later.state === "sent" ? (
          <p role="status">{tx("emailed")}</p>
        ) : !later.open ? (
          <button
            type="button"
            className="fk-live-later-open"
            onClick={() => setLater((l) => ({ ...l, open: true, email: l.email || (emailAnswer ? (kept[emailAnswer]?.value ?? "") : "") }))}
          >
            {tx("saveLater")}
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveForLater();
            }}
          >
            <label htmlFor="fk-later-email">{tx("saveLaterHow")}</label>
            <div className="fk-live-later-row">
              <input
                id="fk-later-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={later.email}
                onChange={(e) => setLater((l) => ({ ...l, email: e.target.value }))}
              />
              <button type="submit" style={button(false)} disabled={later.state === "sending"}>
                {later.state === "sending" ? tx("sending") : tx("emailMe")}
              </button>
            </div>
            {later.error && <p role="alert" className="fk-live-err">{later.error}</p>}
          </form>
        )}
      </div>
    ) : null;

  // Pay what you want: asked just before "Pay and send".
  const choose = payFirst ? data.payment?.choose : null;
  const amountField = choose ? (
    <div className="fk-live-q">
      <label htmlFor="fk-pay-amount" className="fk-live-q-title" style={{ display: "block" }}>
        {tx("youPay", { currency: data.payment!.currency.toUpperCase() })}
      </label>
      <div className="fk-live-q-help" id="fk-pay-min">
        {tx("atLeast", { amount: money(choose.minimum, data.payment!.currency) })}
      </div>
      <div className="fk-live-q-control">
        <input
          id="fk-pay-amount"
          className="fk-live-input"
          type="number"
          inputMode="decimal"
          min={choose.minimum}
          step="0.01"
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          style={{ maxWidth: 220 }}
          aria-describedby="fk-pay-min"
        />
      </div>
    </div>
  ) : null;
  const failure = failed && <div className="fk-live-err" role="alert" style={{ marginTop: 18 }}>{failed}</div>;

  const question = (b: Block, big = false) => {
    if (b.kind === "content") return <ContentBlock key={b._id} block={b} say={say} big={big} />;
    const err =
      fileProblem[b._id] ?? (problem === b._id ? tx("needed") : (ruleErrors[b._id] ?? null));
    const a11y: A11y = {
      id: `q-${b._id}-input`,
      labelledBy: `q-${b._id}-title`,
      describedBy: [b.help ? `q-${b._id}-help` : null, err ? `q-${b._id}-err` : null].filter(Boolean).join(" ") || undefined,
      required: isRequired(b),
      invalid: !!err,
    };
    return (
    <div key={b._id} className="fk-live-q" id={`q-${b._id}`} data-big={big ? "true" : undefined}>
      <div className="fk-live-q-title" id={`q-${b._id}-title`}>
        {say(b.title)}
        {isRequired(b) && (
          <span className="fk-live-req" aria-hidden>
            *
          </span>
        )}
        {quiz && b.marks ? (
          <span className="fk-live-marks">
            {b.marks} {b.marks === 1 ? "mark" : "marks"}
          </span>
        ) : null}
      </div>
      {b.help && (
        <div className="fk-live-q-help" id={`q-${b._id}-help`}>
          {say(b.help)}
        </div>
      )}
      <div className="fk-live-q-control">
        <Control
          a11y={a11y}
          block={b}
          theme={theme}
          value={answers[b._id]}
          onChange={(a) => {
            setAnswers((prev) => ({ ...prev, [b._id]: a }));
            if (problem === b._id) setProblem(null);
            if (ruleErrors[b._id]) setRuleErrors({});
          }}
          onFile={(file) => attach(b, file)}
          capMb={data.uploadCapMb}
          fileFailed={!!fileProblem[b._id]}
          hiddenOptions={hiddenOptions.get(b._id)}
          shuffle={quiz?.shuffleOptions ? seed : undefined}
        />
      </div>
      {err && (
        <div className="fk-live-err" id={`q-${b._id}-err`} role="alert">
          {err}
        </div>
      )}
      {kept[b._id]?.followUp && (
        <div className="fk-live-followup">
          <label htmlFor={`q-${b._id}-followup`}>
            <Sparkles size={14} strokeWidth={1.8} aria-hidden /> {kept[b._id]!.followUp!.question}
          </label>
          <textarea
            id={`q-${b._id}-followup`}
            rows={2}
            placeholder={tx("optional")}
            value={kept[b._id]!.followUp!.answer}
            maxLength={2000}
            onChange={(e) =>
              setAnswers((prev) => ({
                ...prev,
                [b._id]: { ...prev[b._id], followUp: { question: prev[b._id]!.followUp!.question, answer: e.target.value } },
              }))
            }
          />
        </div>
      )}
    </div>
    );
  };

  const progress = (n: number, of: number) => (
    <div
      className="fk-live-progress"
      role="progressbar"
      aria-label={tx("progress")}
      aria-valuemin={0}
      aria-valuemax={of}
      aria-valuenow={n}
    >
      <span style={{ width: `${of ? Math.round((n / of) * 100) : 0}%`, background: theme.primary }} />
    </div>
  );

  const left = attempt?.endsAt ? Math.max(0, attempt.endsAt - clock) : null;
  const timer =
    left !== null ? (
      <div className="fk-live-timer" data-low={left < 60_000 ? "true" : undefined} role="timer" aria-live="off">
        <Clock3 size={15} strokeWidth={1.9} aria-hidden />
        {Math.floor(left / 60_000)}:{String(Math.floor((left % 60_000) / 1000)).padStart(2, "0")} left
      </div>
    ) : null;

  /* ---------- one question at a time ---------- */
  if (conversational) {
    if (!cur) {
      return (
        <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
          {intro}
          <p className="fk-live-note">{tx("noQuestions")}</p>
        </Shell>
      );
    }
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
        {timer}
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
          {lastStep && amountField}
          {failure}
          {proveBox}
          <div className="fk-live-foot fk-live-sticky" style={{ background: theme.bg }}>
            {step > 0 && (
              <button
                type="button"
                style={button(false)}
                onClick={goBack}
              >
                <ArrowLeft size={17} strokeWidth={1.9} aria-hidden /> {tx("back")}
              </button>
            )}
            <button type="submit" style={button(true)} disabled={busy || thinking}>
              {thinking ? tx("oneMoment") : busy ? tx("sending") : lastStep ? (payFirst ? tx("payAndSend") : tx("submit")) : tx("ok")}
            </button>
            {!lastStep && (
              <span className="fk-live-hint">
                press Enter <CornerDownLeft size={14} strokeWidth={1.9} aria-hidden />
              </span>
            )}
          </div>
        </form>
        {laterBox}
        {credit}
      </Shell>
    );
  }

  /* ---------- classic: a page of questions at a time ---------- */
  return (
    <Shell theme={theme} brand={data.brand} logos={data.logos} custom={data.custom}>
      {timer}
      {page === 0 && !standalone && intro}
      {live.length > 1 && (
        <div style={{ marginTop: page === 0 && !standalone ? 34 : 0 }}>
          <div className="fk-live-steplabel">
            <span>
              {tx("pageOf", { n: page + 1, total: live.length })}
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
        {!fields.length && <p className="fk-live-note">{tx("noQuestions")}</p>}
        {lastPage && amountField}
        {failure}
        {proveBox}
        <div className="fk-live-foot">
          {page > 0 && (
            <button type="button" style={button(false)} onClick={goBack}>
              {tx("back")}
            </button>
          )}
          <button type="submit" style={button(true)} disabled={busy || thinking || !fields.length}>
            {thinking ? tx("oneMoment") : busy ? tx("sending") : lastPage ? (resume?.editing ? tx("saveChanges") : payFirst ? tx("payAndSend") : tx("submit")) : tx("next")}
          </button>
          <span style={{ fontSize: 13.5, opacity: 0.75 }}>
            {tx("answeredOf", { n: answeredCount, total: questions.length })}
          </span>
        </div>
      </form>
      {laterBox}
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
  // Written into a <style>: nothing that could end the string, the rule or the element.
  const brandFont = custom?.font ? `${custom.font.name.replace(/["\\<>{};]/g, "")} Formkit brand` : null;
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
          "--fk-live-accent": t.primary,
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
  a11y,
  block,
  theme,
  value,
  onChange,
  onFile,
  capMb = 10,
  fileFailed,
  hiddenOptions,
  shuffle,
}: {
  /** Names, states and descriptions for assistive technology. */
  a11y: A11y;
  block: Block;
  theme: ReturnType<typeof themeOf>;
  value?: Answer;
  onChange: (a: Answer) => void;
  onFile: (file: File) => void;
  capMb?: number;
  /** The last upload for this question was refused or did not finish. */
  fileFailed?: boolean;
  /** Options a logic rule hides right now. */
  hiddenOptions?: Set<string>;
  /** Quiz: a seed that puts the options in this person's own order. */
  shuffle?: number;
}) {
  const tx = useT();
  const radius = Math.min(theme.radius, 24);
  // "Other" was picked but nothing typed yet (an empty answer is no answer).
  const [otherOpen, setOtherOpen] = useState(false);
  // What every native control carries: its name (the question), its help and
  // error text, and whether it is required or wrong.
  const native = {
    id: a11y.id,
    "aria-labelledby": a11y.labelledBy,
    "aria-describedby": a11y.describedBy,
    "aria-required": a11y.required || undefined,
    "aria-invalid": a11y.invalid || undefined,
  };
  // The question's own limits, given to the browser too, so the right
  // keyboard and pickers show; the form still checks them in words.
  const r = block.validation ?? {};
  const limits =
    block.type === "number"
      ? { min: r.min, max: r.max }
      : block.type === "date"
        ? { min: r.minDate, max: r.maxDate }
        : { maxLength: r.maxLength, minLength: r.minLength };
  const group = {
    id: a11y.id,
    "aria-labelledby": a11y.labelledBy,
    "aria-describedby": a11y.describedBy,
    "aria-required": a11y.required || undefined,
    "aria-invalid": a11y.invalid || undefined,
  };
  // The options on offer: minus any a rule hides, each with its places left.
  const listed = (block.options ?? [])
    .map((o, i) => ({ o, left: block.left?.[i] ?? null }))
    .filter((x) => !hiddenOptions?.has(x.o));
  const offered = shuffle === undefined ? listed : shuffled(listed, shuffle + block._id.length, (x) => `${block._id}${x.o}`);
  // In another language an option shows its translation; the answer keeps the form's own option.
  const optionLabel = (o: string) =>
    block.type === "yes-no" ? (o === "Yes" ? tx("yes") : o === "No" ? tx("no") : o) : (block.optionLabels?.[(block.options ?? []).indexOf(o)] ?? o);
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
          {...native}
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
          maxLength={r.maxLength}
          {...native}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      );

    case "single-choice":
    case "yes-no": {
      const options =
        block.type === "yes-no"
          ? ["Yes", "No"].filter((o) => !hiddenOptions?.has(o)).map((o) => ({ o, left: null as number | null }))
          : offered;
      const labels = options.map((x) => x.o);
      const other = block.type !== "yes-no" && !!block.allowOther;
      const typed = other && value?.value && !labels.includes(value.value) ? value.value : null;
      const otherOn = other && (otherOpen || typed !== null);
      const focusable = otherOn
        ? "__other"
        : (options.find((x) => x.o === value?.value)?.o ?? options.find((x) => !(x.left !== null && x.left <= 0))?.o);
      return (
        <>
        <div className="fk-live-choices" role="radiogroup" {...group} onKeyDown={radioKeys}>
          {options.map(({ o, left }) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={value?.value === o}
              tabIndex={o === focusable ? 0 : -1}
              className="fk-live-choice"
              data-picked={value?.value === o ? "true" : undefined}
              data-full={left !== null && left <= 0 ? "true" : undefined}
              disabled={left !== null && left <= 0}
              style={{ borderRadius: radius }}
              onClick={() => {
                setOtherOpen(false);
                onChange({ value: o });
              }}
            >
              {optionLabel(o)}
              {placeNote(left) && <span className="fk-live-places">{placeNote(left)}</span>}
            </button>
          ))}
          {other && (
            <button
              type="button"
              role="radio"
              aria-checked={otherOn}
              tabIndex={focusable === "__other" ? 0 : -1}
              className="fk-live-choice"
              data-picked={otherOn ? "true" : undefined}
              style={{ borderRadius: radius }}
              onClick={() => {
                setOtherOpen(true);
                onChange({ value: typed ?? "" });
              }}
            >
              {tx("other")}
            </button>
          )}
        </div>
        {otherOn && (
          <input
            style={{ ...box, marginTop: 10 }}
            autoFocus
            aria-label={`${tx("other")}: ${tx("pleaseSay")}`}
            placeholder={tx("pleaseSay")}
            value={typed ?? ""}
            maxLength={200}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        )}
        </>
      );
    }

    case "multi-choice": {
      const labels = offered.map((x) => x.o);
      const all = value?.values ?? [];
      const picked = block.allowOther ? all.filter((v) => labels.includes(v)) : all;
      const typed = block.allowOther ? (all.find((v) => !labels.includes(v)) ?? "") : "";
      const otherOn = !!block.allowOther && (otherOpen || !!typed);
      const withOther = (list: string[]) => (otherOn && typed ? [...list, typed] : list);
      return (
        <>
        <div className="fk-live-choices" role="group" {...group}>
          {offered.map(({ o, left }) => (
            <button
              key={o}
              type="button"
              role="checkbox"
              aria-checked={picked.includes(o)}
              className="fk-live-choice"
              data-picked={picked.includes(o) ? "true" : undefined}
              data-full={left !== null && left <= 0 && !picked.includes(o) ? "true" : undefined}
              disabled={left !== null && left <= 0 && !picked.includes(o)}
              style={{ borderRadius: radius }}
              onClick={() =>
                onChange({
                  values: withOther(picked.includes(o) ? picked.filter((p) => p !== o) : [...picked, o]),
                })
              }
            >
              {optionLabel(o)}
              {placeNote(left) && <span className="fk-live-places">{placeNote(left)}</span>}
            </button>
          ))}
          {block.allowOther && (
            <button
              type="button"
              role="checkbox"
              aria-checked={otherOn}
              className="fk-live-choice"
              data-picked={otherOn ? "true" : undefined}
              style={{ borderRadius: radius }}
              onClick={() => {
                if (otherOn) {
                  setOtherOpen(false);
                  onChange({ values: picked });
                } else setOtherOpen(true);
              }}
            >
              {tx("other")}
            </button>
          )}
        </div>
        {otherOn && (
          <input
            style={{ ...box, marginTop: 10 }}
            autoFocus
            aria-label={`${tx("other")}: ${tx("pleaseSay")}`}
            placeholder={tx("pleaseSay")}
            value={typed}
            maxLength={200}
            onChange={(e) => onChange({ values: e.target.value ? [...picked, e.target.value] : picked })}
          />
        )}
        </>
      );
    }

    case "matrix":
      return (
        <MatrixControl
          rows={block.rows ?? []}
          columns={block.options ?? []}
          rowLabels={block.rowLabels ?? undefined}
          columnLabels={block.optionLabels ?? undefined}
          multi={!!block.matrixMulti}
          values={value?.values ?? []}
          radius={radius}
          label={block.title ?? "This question"}
          group={group}
          onChange={(values) => onChange(values.length ? { values } : {})}
        />
      );

    case "ranking":
      return (
        <RankingControl
          options={block.options ?? []}
          labels={block.optionLabels ?? undefined}
          values={value?.values ?? []}
          radius={radius}
          label={block.title ?? "This question"}
          group={group}
          onChange={(values) => onChange({ values })}
        />
      );

    case "dropdown":
      return (
        <select
          style={box}
          value={value?.value ?? ""}
          {...native}
          onChange={(e) => onChange({ value: e.target.value })}
        >
          <option value="">{tx("chooseOne")}</option>
          {offered.map(({ o, left }) => (
            <option key={o} value={o} disabled={left !== null && left <= 0}>
              {placeNote(left) ? `${optionLabel(o)} (${placeNote(left)})` : optionLabel(o)}
            </option>
          ))}
        </select>
      );

    case "rating": {
      const max = block.scaleMax ?? 5;
      return (
        <div className="fk-live-scale" role="radiogroup" {...group} onKeyDown={radioKeys}>
          {Array.from({ length: max }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={Number(value?.value) === i + 1}
              tabIndex={(Number(value?.value) || 1) === i + 1 ? 0 : -1}
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
        <div>
          <div className="fk-live-scale" role="radiogroup" {...group} onKeyDown={radioKeys}>
          {Array.from({ length: Math.max(0, to - from + 1) }).map((_, i) => {
            const n = from + i;
            const chosen = value?.value === String(n);
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={chosen}
                aria-label={[
                  String(n),
                  n === from ? block.scaleLabels?.start : undefined,
                  n === to ? block.scaleLabels?.end : undefined,
                ]
                  .filter(Boolean)
                  .join(", ")}
                tabIndex={chosen || (!value?.value && i === 0) ? 0 : -1}
                data-picked={value?.value === String(n) ? "true" : undefined}
                onClick={() => onChange({ value: String(n) })}
              >
                <span>{n}</span>
              </button>
            );
          })}
        </div>
          {(block.scaleLabels?.start || block.scaleLabels?.end) && (
            <div className="fk-live-scale-labels" aria-hidden>
              <span>{block.scaleLabels?.start}</span>
              <span>{block.scaleLabels?.end}</span>
            </div>
          )}
        </div>
      );
    }

    case "file":
      return (
        <label
          className="fk-live-file"
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
                ? tx("chooseTypedFile", { types: block.accept.join(" "), mb: capMb })
                : tx("chooseFile", { mb: capMb }))}
          </span>
          <input
            type="file"
            {...native}
            className="sr-only"
            accept={block.accept?.length ? block.accept.join(",") : undefined}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </label>
      );

    case "voice":
      return (
        <VoiceRecorder
          maxSeconds={voiceLength(block.maxSeconds)}
          accent={theme.primary}
          radius={radius}
          saved={!!value?.fileId}
          failed={fileFailed}
          label={block.title ?? "this question"}
          onFile={onFile}
          onClear={() => onChange({})}
        />
      );

    case "signature":
      return (
        <SignaturePad
          name={value?.value ?? ""}
          drawn={!!value?.fileId}
          failed={fileFailed}
          accent={theme.primary}
          radius={radius}
          label={block.title ?? "this question"}
          inputProps={{ ...native, style: { ...box, marginTop: 10 } }}
          onName={(name) => onChange({ ...value, value: name })}
          onDrawing={onFile}
          onClear={() => onChange({ value: value?.value })}
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
          {...native}
          {...limits}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      );
  }
}

/**
 * Content between questions: words, a picture (shown only with its
 * description) or a YouTube or Vimeo video, embedded without tracking cookies.
 */
function ContentBlock({ block, say, big }: { block: Block; say: (t: string | null | undefined) => string; big: boolean }) {
  const embed = block.type === "video" && block.videoUrl ? videoEmbed(block.videoUrl) : null;
  return (
    <div className="fk-live-q fk-live-content" id={`q-${block._id}`} data-big={big ? "true" : undefined}>
      {block.type === "statement" && (
        <>
          {block.title && <h2 className="fk-live-q-title">{say(block.title)}</h2>}
          {block.help && <p className="fk-live-content-text">{say(block.help)}</p>}
        </>
      )}
      {block.type === "image" && block.imageUrl && block.alt && (
        <figure style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the owner's own upload, at its own size */}
          <img src={block.imageUrl} alt={block.alt} className="fk-live-content-image" loading="lazy" />
          {block.title && <figcaption className="fk-live-q-help">{say(block.title)}</figcaption>}
        </figure>
      )}
      {embed && (
        <>
          {block.title && <div className="fk-live-q-title">{say(block.title)}</div>}
          <div className="fk-live-video">
            <iframe
              src={embed}
              title={block.title || "Video"}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </>
      )}
    </div>
  );
}

type A11y = { id: string; labelledBy: string; describedBy?: string; required: boolean; invalid: boolean };

/**
 * Arrow keys move through a radio group, choosing as they go, the way native
 * radio buttons behave; Tab enters and leaves the group in one stop.
 */
function radioKeys(e: React.KeyboardEvent<HTMLDivElement>) {
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  const radios = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')];
  const at = radios.indexOf(document.activeElement as HTMLButtonElement);
  if (!radios.length) return;
  e.preventDefault();
  const next = radios[(at + step + radios.length) % radios.length]!;
  next.focus();
  next.click();
}

/** Moves focus to a question's control (or its first option) after a problem is found. */
function focusQuestion(id: string) {
  window.requestAnimationFrame(() => {
    const root = document.getElementById(`q-${id}`);
    root?.scrollIntoView({ block: "center" });
    const target =
      root?.querySelector<HTMLElement>(`#q-${id}-input:not([role="radiogroup"]):not([role="group"])`) ??
      root?.querySelector<HTMLElement>('[role="radio"][tabindex="0"], [role="checkbox"], input, textarea, select, button');
    target?.focus({ preventScroll: true });
  });
}

/** Enough to tell a phone from a laptop, and nothing more. */
function describeDevice() {
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
    } else if (!["file", "signature", "voice", "matrix", "ranking"].includes(b.type ?? "")) {
      out[b._id] = { value: raw.slice(0, 2000) };
    }
  }
  return out;
}
