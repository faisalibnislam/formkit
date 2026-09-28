"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowLeft, Check, CornerDownLeft, Lock, Paperclip } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  LOGO_PX,
  SIZE_SCALE,
  WEIGHTS,
  buttonInk,
  themeOf,
} from "@/components/app/editor/themes";
import { fontStack, loadFont } from "@/components/app/editor/fonts";
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
};

type Rule = {
  join: "and" | "or";
  conditions: { blockId?: Id<"blocks">; operator: string; value?: string }[];
  action: "show" | "hide" | "require" | "jump";
  targetId: Id<"blocks"> | null;
};

export type Answer = { value?: string; values?: string[]; fileId?: Id<"_storage">; fileName?: string };

export type OpenForm = {
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
};

export type SubmitArgs = {
  partial: boolean;
  human?: boolean;
  trap?: string;
  durationMs?: number;
  device?: string;
  answers: ({ blockId: Id<"blocks"> } & Answer)[];
};

/** Clock reads live out here, where they are not part of a render. */
const now = () => Date.now();
const since = (from: number) => (from ? now() - from : undefined);

const filled = (a?: Answer) => !!(a?.value?.trim() || a?.values?.length || a?.fileId);

function matches(rule: Rule, answers: Record<string, Answer>) {
  const results = rule.conditions.map((c) => {
    if (!c.blockId) return false;
    const a = answers[c.blockId];
    const given = a?.values?.join(", ") ?? a?.value ?? "";
    const want = c.value ?? "";
    const same = (x: string) => x.trim().toLowerCase() === want.trim().toLowerCase();
    // A multiple-choice answer "is" an option when that option is among those picked.
    const is = a?.values ? a.values.some(same) : same(given);
    switch (c.operator) {
      case "is":
        return is;
      case "is-not":
        return !is;
      case "contains":
        return given.toLowerCase().includes(want.toLowerCase());
      case "is-empty":
        return given.trim() === "";
      case "is-not-empty":
        return given.trim() !== "";
      case "at-least":
        return given.trim() !== "" && Number(given) >= Number(want);
      case "at-most":
        return given.trim() !== "" && Number(given) <= Number(want);
      case "greater":
        return given.trim() !== "" && Number(given) > Number(want);
      case "less":
        return given.trim() !== "" && Number(given) < Number(want);
      default:
        return false;
    }
  });
  return rule.join === "or" ? results.some(Boolean) : results.every(Boolean);
}

export function FormRunner({
  data,
  mode,
  closed = false,
  resume,
  onSubmit,
  onStart,
  upload,
  scrollRoot,
}: {
  data: OpenForm;
  mode: "live" | "preview";
  /** Show the closed screen instead of the questions. */
  closed?: boolean;
  /** Answers already given — a partial being finished, or a response being changed. */
  resume?: { token: string; answers: Record<string, Answer>; editing: boolean };
  onSubmit: (args: SubmitArgs) => Promise<{ resumeToken: string }>;
  onStart?: () => void;
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
  const [answers, setAnswers] = useState<Record<string, Answer>>(resume?.answers ?? {});
  const [problem, setProblem] = useState<string | null>(null);
  const [fileProblem, setFileProblem] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ token: string } | null>(null);
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

  /* ---------- logic ---------- */
  const { hidden, forced, jumpTo } = useMemo(() => {
    const h = new Set<string>();
    const f = new Set<string>();
    let j: string | null = null;
    for (const rule of data.logic) {
      if (!rule.targetId) continue;
      const hit = matches(rule, answers);
      if (rule.action === "show" && !hit) h.add(rule.targetId);
      if (rule.action === "hide" && hit) h.add(rule.targetId);
      if (rule.action === "require" && hit) f.add(rule.targetId);
      if (rule.action === "jump" && hit && j === null) j = rule.targetId;
    }
    return { hidden: h, forced: f, jumpTo: j };
  }, [answers, data.logic]);

  /* ---------- pages, and the questions in order ---------- */
  const pages: { name: string; fields: Block[] }[] = [{ name: "", fields: [] }];
  for (const b of blocks) {
    if (b.kind === "pagebreak") pages.push({ name: b.pageName ?? "", fields: [] });
    else if (!hidden.has(b._id)) pages[pages.length - 1]!.fields.push(b);
  }
  const live = pages.filter((p) => p.fields.length > 0);
  const fields = live.flatMap((p) => p.fields);
  const current = live[Math.min(page, Math.max(0, live.length - 1))];
  const lastPage = page >= live.length - 1;
  const cur = fields[Math.min(step, Math.max(0, fields.length - 1))];
  const lastStep = step >= fields.length - 1;
  const answeredCount = fields.filter((b) => filled(answers[b._id])).length;

  function isRequired(b: Block) {
    // A hidden question is never required, or the form cannot be finished.
    if (hidden.has(b._id)) return false;
    if (b.required || forced.has(b._id)) return true;
    return data.rules.requireEmail && b.type === "email";
  }
  const firstMissing = (list: Block[]) => list.find((b) => isRequired(b) && !filled(answers[b._id]));

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

  // A redirect after submitting, on the live form only.
  useEffect(() => {
    if (!done || mode !== "live" || !data.thanks?.redirect) return;
    const t = window.setTimeout(() => window.location.assign(data.thanks!.redirect!), 1400);
    return () => window.clearTimeout(t);
  }, [done, mode, data.thanks]);

  async function send(asHuman = human) {
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
        answers: Object.entries(answers)
          .filter(([id]) => fields.some((f) => f._id === id))
          .map(([blockId, a]) => ({ blockId: blockId as Id<"blocks">, ...a })),
      });
      setProve(false);
      setDone({ token: r.resumeToken });
      toTop();
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

  function nextPage() {
    const missing = firstMissing(current?.fields ?? []);
    if (missing) {
      setProblem(missing._id);
      document.getElementById(`q-${missing._id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    setProblem(null);
    if (!lastPage) {
      // A matching "jump to" rule skips straight to the page that holds its
      // question, as long as that page is ahead of this one.
      const jumpPage = jumpTo ? live.findIndex((p) => p.fields.some((f) => f._id === jumpTo)) : -1;
      setPage(jumpPage > page ? jumpPage : page + 1);
      toTop();
      return;
    }
    void send();
  }

  function nextStep() {
    if (!cur) return;
    if (isRequired(cur) && !filled(answers[cur._id])) {
      setProblem(cur._id);
      return;
    }
    setProblem(null);
    if (!lastStep) {
      const jumpIndex = jumpTo ? fields.findIndex((f) => f._id === jumpTo) : -1;
      setStep(jumpIndex > step ? jumpIndex : step + 1);
      return;
    }
    const missing = firstMissing(fields);
    if (missing) {
      setStep(fields.indexOf(missing));
      setProblem(missing._id);
      return;
    }
    void send();
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
      <Shell theme={theme} brand={data.brand} logos={data.logos}>
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
  if (done) {
    const t = data.thanks;
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos}>
        <div style={{ textAlign: split ? "left" : "center", paddingTop: "4vh" }}>
          <span className="fk-live-lock" style={{ background: theme.primary, color: ink }}>
            <Check size={30} strokeWidth={2} aria-hidden />
          </span>
          <h1 style={{ marginTop: 22 }}>{t?.title || "Thank you"}</h1>
          <p className="fk-live-lede">{t?.message || "Your answers are in."}</p>
          {t?.redirect && (
            <p className="fk-live-note">
              {mode === "live"
                ? "Taking you on…"
                : `On the live form, people go straight to ${t.redirect} from here.`}
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
        {data.welcome?.title || data.title}
      </h1>
      {data.welcome?.message && (
        <p className="fk-live-lede" style={{ textAlign: split ? undefined : "center" }}>
          {data.welcome.message}
        </p>
      )}
    </>
  );

  /* ---------- a welcome page of its own ---------- */
  if (!started) {
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos}>
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
        {b.title}
        {isRequired(b) && (
          <span className="fk-live-req" aria-hidden>
            *
          </span>
        )}
      </div>
      {b.help && <div className="fk-live-q-help">{b.help}</div>}
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
        <Shell theme={theme} brand={data.brand} logos={data.logos}>
          {intro}
          <p className="fk-live-note">There are no questions on this form yet.</p>
        </Shell>
      );
    }
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos}>
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
            <button type="submit" style={button(true)} disabled={busy}>
              {busy ? "Sending…" : lastStep ? "Submit" : "OK"}
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
    <Shell theme={theme} brand={data.brand} logos={data.logos}>
      {page === 0 && !standalone && intro}
      {live.length > 1 && (
        <div style={{ marginTop: page === 0 && !standalone ? 34 : 0 }}>
          <div className="fk-live-steplabel">
            <span>
              Page {page + 1} of {live.length}
            </span>
            {progress(page + 1, live.length)}
          </div>
          {current?.name && <h2 className="fk-live-pagetitle">{current.name}</h2>}
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
          <button type="submit" style={button(true)} disabled={busy || !fields.length}>
            {busy ? "Sending…" : lastPage ? (resume?.editing ? "Save changes" : "Submit") : "Next"}
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
  children,
}: {
  theme: ReturnType<typeof themeOf> | null;
  brand?: { name: string; logoUrl: string | null; color: string | null };
  logos?: { name: string; url: string | null }[];
  children: React.ReactNode;
}) {
  const t = theme ?? themeOf(null);
  useEffect(() => {
    loadFont(t.font);
    loadFont(t.heading);
  }, [t.font, t.heading]);
  const split = t.layout === "split";
  return (
    <div
      className="fk-live"
      data-layout={t.layout}
      style={
        {
          background: t.bg,
          color: t.text,
          fontSize: 16 * SIZE_SCALE[t.size],
          fontFamily: fontStack(t.font),
          "--fk-live-heading": fontStack(t.heading),
          "--fk-live-weight": WEIGHTS[t.weight],
        } as React.CSSProperties
      }
    >
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
}: {
  block: Block;
  theme: ReturnType<typeof themeOf>;
  value?: Answer;
  onChange: (a: Answer) => void;
  onFile: (file: File) => void;
}) {
  const radius = Math.min(theme.radius, 24);
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
      const options = block.type === "yes-no" ? ["Yes", "No"] : (block.options ?? []);
      return (
        <div className="fk-live-choices">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              className="fk-live-choice"
              data-picked={value?.value === o ? "true" : undefined}
              style={{ borderRadius: radius }}
              onClick={() => onChange({ value: o })}
            >
              {o}
            </button>
          ))}
        </div>
      );
    }

    case "multi-choice": {
      const picked = value?.values ?? [];
      return (
        <div className="fk-live-choices">
          {(block.options ?? []).map((o) => (
            <button
              key={o}
              type="button"
              className="fk-live-choice"
              data-picked={picked.includes(o) ? "true" : undefined}
              style={{ borderRadius: radius }}
              onClick={() =>
                onChange({
                  values: picked.includes(o) ? picked.filter((p) => p !== o) : [...picked, o],
                })
              }
            >
              {o}
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
          {(block.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
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
                ? `Choose a ${block.accept.join(" ")} file — up to 10 MB`
                : "Choose a file — up to 10 MB")}
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
