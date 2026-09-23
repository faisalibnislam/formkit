"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Paperclip } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  LOGO_PX,
  SIZE_SCALE,
  WEIGHTS,
  themeOf,
} from "@/components/app/editor/themes";
import { fontStack, loadFont } from "@/components/app/editor/fonts";
import { LogoLockup } from "./LogoLockup";

/**
 * The published form, as somebody answering it sees it.
 *
 * Three things matter here and are easy to get wrong:
 *  - Leaving keeps what was answered. The partial is saved on the way out and
 *    carries a token, so the owner can send the person back to it.
 *  - Logic is evaluated on every answer, and a hidden question is never
 *    required — otherwise a form can become impossible to finish.
 *  - Required means required: the page will not advance, and the message says
 *    which question is waiting.
 */

type Block = {
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

type Answer = { value?: string; values?: string[]; fileId?: Id<"_storage">; fileName?: string };

/** Clock reads live out here, where they are not part of a render. */
const now = () => Date.now();
const since = (from: number) => (from ? now() - from : undefined);

function matches(rule: Rule, answers: Record<string, Answer>) {
  const results = rule.conditions.map((c) => {
    if (!c.blockId) return false;
    const a = answers[c.blockId];
    const given = a?.values?.join(", ") ?? a?.value ?? "";
    const want = c.value ?? "";
    switch (c.operator) {
      case "is":
        return given.trim().toLowerCase() === want.trim().toLowerCase();
      case "is-not":
        return given.trim().toLowerCase() !== want.trim().toLowerCase();
      case "contains":
        return given.toLowerCase().includes(want.toLowerCase());
      case "is-empty":
        return given.trim() === "";
      case "is-not-empty":
        return given.trim() !== "";
      case "at-least":
        return Number(given) >= Number(want);
      case "at-most":
        return Number(given) <= Number(want);
      case "greater":
        return Number(given) > Number(want);
      case "less":
        return Number(given) < Number(want);
      default:
        return false;
    }
  });
  return rule.join === "or" ? results.some(Boolean) : results.every(Boolean);
}

export function LiveForm({
  slug,
  handle,
  resume,
}: {
  slug: string;
  handle?: string;
  /** Somebody coming back to a form they left; their answers are already here. */
  resume?: { responseId: Id<"responses">; answers: Record<string, Answer> };
}) {
  const data = useQuery(api.publicForm.bySlug, { slug, handle });
  const recordView = useMutation(api.publicForm.recordView);
  const uploadUrl = useMutation(api.publicForm.uploadUrl);
  const submit = useMutation(api.publicForm.submit);

  const [started, setStarted] = useState(!!resume);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>(resume?.answers ?? {});
  const [problem, setProblem] = useState<string | null>(null);
  const [fileProblem, setFileProblem] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const openedAt = useRef(0);
  const viewed = useRef(false);
  const savedPartial = useRef(false);

  const open = data?.state === "open" ? data : null;
  const blocks = useMemo(() => (open?.blocks ?? []) as Block[], [open]);
  const rules = useMemo(() => (open?.rules ?? []) as Rule[], [open]);

  useEffect(() => {
    openedAt.current = now();
  }, []);

  useEffect(() => {
    if (open && !viewed.current) {
      viewed.current = true;
      void recordView({ formId: open.formId });
    }
  }, [open, recordView]);

  // Leaving keeps what was answered.
  useEffect(() => {
    if (!open) return;
    const save = () => {
      if (savedPartial.current || done) return;
      const filled = Object.entries(answers).filter(
        ([, a]) => a.value || a.values?.length || a.fileId,
      );
      if (!filled.length) return;
      savedPartial.current = true;
      void submit({
        formId: open.formId,
        partial: true,
        resumeOf: resume?.responseId,
        device: describeDevice(),
        source: document.referrer || undefined,
        durationMs: since(openedAt.current),
        answers: filled.map(([blockId, a]) => ({ blockId: blockId as Id<"blocks">, ...a })),
      });
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [answers, done, open, resume?.responseId, submit]);

  if (data === undefined) return null;

  if (data === null) {
    return (
      <Shell theme={null}>
        <h1>That form is not here</h1>
        <p style={{ marginTop: 12, opacity: 0.7 }}>
          The link may be mistyped, or the form may have been deleted.
        </p>
      </Shell>
    );
  }

  if (data.state === "draft") {
    return (
      <Shell theme={null}>
        <h1>Not published yet</h1>
        <p style={{ marginTop: 12, opacity: 0.7 }}>
          Whoever sent you this link has not finished the form. Ask them for it again in a while.
        </p>
      </Shell>
    );
  }

  if (data.state === "closed") {
    return (
      <Shell theme={null} brand={data.brand}>
        <h1>{data.title}</h1>
        <p style={{ marginTop: 12, opacity: 0.7 }}>{data.message}</p>
      </Shell>
    );
  }

  const theme = themeOf(open!.theme);
  const scale = SIZE_SCALE[theme.size];

  /* ---------- logic ---------- */
  const hidden = new Set<string>();
  const forced = new Set<string>();
  let jumpTo: string | null = null;
  for (const rule of rules) {
    if (!rule.targetId) continue;
    const hit = matches(rule, answers);
    if (rule.action === "show" && !hit) hidden.add(rule.targetId);
    if (rule.action === "hide" && hit) hidden.add(rule.targetId);
    if (rule.action === "require" && hit) forced.add(rule.targetId);
    if (rule.action === "jump" && hit && jumpTo === null) jumpTo = rule.targetId;
  }

  /* ---------- paging ---------- */
  const pages: { name: string; fields: Block[] }[] = [{ name: "", fields: [] }];
  for (const b of blocks) {
    if (b.kind === "pagebreak") pages.push({ name: b.pageName ?? "", fields: [] });
    else if (!hidden.has(b._id)) pages[pages.length - 1]!.fields.push(b);
  }
  const live = pages.filter((p) => p.fields.length > 0);
  const current = live[Math.min(page, live.length - 1)];
  const last = page >= live.length - 1;

  const answeredCount = Object.values(answers).filter(
    (a) => a.value || a.values?.length || a.fileId,
  ).length;
  const totalVisible = live.reduce((n, p) => n + p.fields.length, 0);

  function isRequired(b: Block) {
    // A hidden question is never required, or the form cannot be finished.
    return !hidden.has(b._id) && (b.required || forced.has(b._id));
  }

  function firstMissing(fields: Block[]) {
    return fields.find((b) => {
      if (!isRequired(b)) return false;
      const a = answers[b._id];
      return !(a?.value || a?.values?.length || a?.fileId);
    });
  }

  async function next() {
    const missing = firstMissing(current?.fields ?? []);
    if (missing) {
      setProblem(missing._id);
      document.getElementById(`q-${missing._id}`)?.scrollIntoView({ block: "center" });
      return;
    }
    setProblem(null);
    if (!last) {
      // A matching "jump to" rule skips straight to the page that holds its
      // question, as long as that page is ahead of this one.
      const jumpPage = jumpTo
        ? live.findIndex((p) => p.fields.some((f) => f._id === jumpTo))
        : -1;
      setPage(jumpPage > page ? jumpPage : page + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    setBusy(true);
    try {
      savedPartial.current = true;
      await submit({
        formId: open!.formId,
        partial: false,
        resumeOf: resume?.responseId,
        device: describeDevice(),
        source: document.referrer || undefined,
        durationMs: since(openedAt.current),
        answers: Object.entries(answers).map(([blockId, a]) => ({
          blockId: blockId as Id<"blocks">,
          ...a,
        })),
      });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setBusy(false);
      setProblem(null);
      alert(e instanceof Error ? e.message : "That did not send. Try again in a moment.");
    }
  }

  async function attach(block: Block, file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setFileProblem((p) => ({ ...p, [block._id]: "That file is over 10 MB. Try a smaller one." }));
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
    const url = await uploadUrl({});
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    setAnswers((a) => ({ ...a, [block._id]: { fileId: storageId, fileName: file.name } }));
  }

  /* ---------- screens ---------- */
  if (done) {
    return (
      <Shell theme={theme} brand={open!.brand} logos={open!.logos}>
        <h1>{open!.thanks?.title ?? "Thank you"}</h1>
        <p style={{ marginTop: 12, opacity: 0.72, fontSize: 16 * scale, lineHeight: 1.6 }}>
          {open!.thanks?.message ?? "Your answers are in."}
        </p>
        {open!.thanks?.buttonUrl && (
          <div className="fk-live-foot">
            <a
              href={open!.thanks.buttonUrl}
              style={{
                padding: "13px 24px",
                borderRadius: Math.min(theme.radius, 999),
                background: theme.primary,
                color: "#ffffff",
                fontSize: 15 * scale,
                fontWeight: 500,
              }}
            >
              {open!.thanks.buttonLabel ?? "Continue"}
            </a>
          </div>
        )}
      </Shell>
    );
  }

  if (!started && open!.welcome) {
    return (
      <Shell theme={theme} brand={open!.brand} logos={open!.logos}>
        <h1>{open!.welcome.title || open!.title}</h1>
        <p style={{ marginTop: 12, opacity: 0.72, fontSize: 16 * scale, lineHeight: 1.6 }}>
          {open!.welcome.message}
        </p>
        <div className="fk-live-foot">
          <button
            type="button"
            onClick={() => {
              setStarted(true);
              void recordView({ formId: open!.formId, started: true });
            }}
            style={{
              padding: "14px 26px",
              border: "none",
              borderRadius: Math.min(theme.radius, 999),
              background: theme.primary,
              color: "#ffffff",
              font: "inherit",
              fontSize: 15.5 * scale,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {open!.welcome.button ?? "Start"}
          </button>
          <span style={{ fontSize: 13.5, opacity: 0.6 }}>
            {totalVisible} {totalVisible === 1 ? "question" : "questions"}
          </span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell theme={theme} brand={open!.brand} logos={open!.logos}>
      {live.length > 1 && (
        <div style={{ marginBottom: 20, fontSize: 13.5, opacity: 0.6 }}>
          {current?.name || `Page ${page + 1}`} · {page + 1} of {live.length}
        </div>
      )}
      <h1>{open!.title}</h1>

      {(current?.fields ?? []).map((b) => (
        <div key={b._id} className="fk-live-q" id={`q-${b._id}`}>
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
            problem === b._id && (
              <div className="fk-live-err">This one is needed before you can go on.</div>
            )
          )}
        </div>
      ))}

      <div className="fk-live-foot">
        {page > 0 && (
          <button
            type="button"
            onClick={() => {
              setPage((p) => p - 1);
              window.scrollTo({ top: 0 });
            }}
            style={{
              padding: "13px 22px",
              border: "none",
              borderRadius: Math.min(theme.radius, 999),
              background: "rgba(0,0,0,.06)",
              color: "inherit",
              font: "inherit",
              fontSize: 15 * scale,
              cursor: "pointer",
            }}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={next}
          disabled={busy}
          style={{
            padding: "14px 26px",
            border: "none",
            borderRadius: Math.min(theme.radius, 999),
            background: theme.primary,
            color: "#ffffff",
            font: "inherit",
            fontSize: 15.5 * scale,
            fontWeight: 500,
            cursor: busy ? "progress" : "pointer",
          }}
        >
          {busy ? "Sending…" : last ? "Send" : "Next"}
        </button>
        <span style={{ fontSize: 13.5, opacity: 0.6 }}>
          {answeredCount} of {totalVisible} answered
        </span>
      </div>

      <div className="fk-live-credit">Made with Formkit</div>
    </Shell>
  );
}

/* ---------- the shell the form is painted into ---------- */

function Shell({
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
function describeDevice() {
  if (typeof navigator === "undefined") return undefined;
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Phone";
  return "Desktop";
}
