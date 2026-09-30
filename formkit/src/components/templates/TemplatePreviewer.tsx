"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, RotateCcw, Star, Upload } from "lucide-react";
import { THEME_PRESETS } from "../../../convex/model/themePresets";
import type { PreviewQuestion, TemplatePreview } from "@/content/templatePreview";

/**
 * The template, live: the real questions, one at a time, as a respondent
 * would fill them in. Rows further down the page can jump it to a question
 * through the context, so the list and the preview stay one thing.
 */

type Jump = { step: number; go: (i: number) => void; anchor: React.RefObject<HTMLDivElement | null> };
const JumpContext = createContext<Jump | null>(null);

export function TemplatePreviewProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(-1);
  const anchor = useRef<HTMLDivElement | null>(null);
  return <JumpContext.Provider value={{ step, go: setStep, anchor }}>{children}</JumpContext.Provider>;
}

/** A question row that opens that question in the preview. */
export function QuestionJump({ index, children }: { index: number; children: ReactNode }) {
  const ctx = useContext(JumpContext);
  if (!ctx) return <>{children}</>;
  const on = ctx.step === index;
  return (
    <button
      type="button"
      className="fk-tpl-qrow fk-tpl-qjump"
      aria-pressed={on}
      onClick={() => {
        ctx.go(index);
        ctx.anchor.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
    >
      {children}
      <span className="fk-tpl-qpeek">
        <Eye size={14} strokeWidth={2} aria-hidden /> {on ? "In the preview" : "Preview"}
      </span>
    </button>
  );
}

const THEMES = ["sky", "paper", "mint", "blush", "midnight"] as const;

const PLACEHOLDER: Record<string, string> = {
  "short-text": "Type your answer",
  "long-text": "Type your answer",
  email: "you@company.com",
  name: "Your full name",
  phone: "+1 555 010 2030",
  url: "https://",
  number: "0",
  company: "Company name",
  address: "Street, city, postcode",
};

export function TemplatePreviewer({ preview, slug, name }: { preview: TemplatePreview; slug: string; name: string }) {
  const ctx = useContext(JumpContext);
  const [ownStep, setOwnStep] = useState(-1);
  const step = ctx ? ctx.step : ownStep;
  const go = ctx ? ctx.go : setOwnStep;
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [themeId, setThemeId] = useState<(typeof THEMES)[number]>("sky");
  const theme = THEME_PRESETS.find((t) => t.id === themeId)!;
  const dark = theme.text === "#ffffff";
  const n = preview.questions.length;
  const q = step >= 0 && step < n ? preview.questions[step]! : null;
  const set = (v: string | string[]) => setAnswers({ ...answers, [step]: v });

  return (
    <div className="fk-tp" ref={ctx?.anchor}>
      <div className="fk-tp-phone">
        <span className="fk-tp-notch" aria-hidden />
        <div
          className="fk-tp-screen"
          data-dark={dark || undefined}
          style={{
            ["--tp-bg" as string]: theme.bg,
            ["--tp-surface" as string]: theme.surface,
            ["--tp-text" as string]: theme.text,
            ["--tp-primary" as string]: theme.primary,
            ["--tp-on-primary" as string]: dark ? "#21282E" : "#ffffff",
            ["--tp-radius" as string]: `${Math.min(22, theme.radius)}px`,
          }}
        >
          <span className="fk-tp-url">formkit.app/you/{slug}</span>
          {step >= 0 && step < n && (
            <div className="fk-tp-top">
              <span>{q?.page}</span>
              <span>
                {step + 1} / {n}
              </span>
            </div>
          )}
          {step >= 0 && step < n && (
            <span className="fk-tp-progress" aria-hidden>
              <i style={{ width: `${((step + 1) / n) * 100}%` }} />
            </span>
          )}

          <div className="fk-tp-card" key={`${step}-${themeId}`}>
            {step < 0 ? (
              <div className="fk-tp-welcome">
                <span className="fk-tp-kicker">{name}</span>
                <h3>{preview.welcome.title}</h3>
                <p>{preview.welcome.message}</p>
                <button type="button" className="fk-tp-primary" onClick={() => go(0)}>
                  {preview.welcome.button} <ArrowRight size={15} strokeWidth={2} aria-hidden />
                </button>
                <small>
                  {n} questions · {preview.pages.length} {preview.pages.length === 1 ? "page" : "pages"}
                </small>
              </div>
            ) : step >= n ? (
              <div className="fk-tp-welcome">
                <span className="fk-tp-done">
                  <Check size={22} strokeWidth={2.6} aria-hidden />
                </span>
                <h3>{preview.thanks.title}</h3>
                <p>{preview.thanks.message}</p>
                <button type="button" className="fk-tp-ghost" onClick={() => go(-1)}>
                  <RotateCcw size={14} strokeWidth={2} aria-hidden /> Start again
                </button>
              </div>
            ) : (
              q && (
                <>
                  <label className="fk-tp-q" htmlFor="fk-tp-input">
                    {q.title}
                    {q.required && <em>Required</em>}
                  </label>
                  {q.help && <p className="fk-tp-help">{q.help}</p>}
                  <Field q={q} value={answers[step]} onChange={set} />
                </>
              )
            )}
          </div>

          {step >= 0 && step < n && (
            <div className="fk-tp-nav">
              <button type="button" className="fk-tp-back" onClick={() => go(step - 1)} aria-label="Back">
                <ArrowLeft size={16} strokeWidth={2} />
              </button>
              <button type="button" className="fk-tp-primary" onClick={() => go(step + 1)}>
                {step === n - 1 ? "Submit" : "Continue"} <ArrowRight size={15} strokeWidth={2} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="fk-tp-themes" role="radiogroup" aria-label="Try a theme">
        <span>Try a theme</span>
        {THEMES.map((id) => {
          const t = THEME_PRESETS.find((x) => x.id === id)!;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === themeId}
              aria-label={t.name}
              title={t.name}
              onClick={() => setThemeId(id)}
              style={{ background: `linear-gradient(135deg, ${t.bg} 0 55%, ${t.primary} 55% 100%)` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Field({
  q,
  value,
  onChange,
}: {
  q: PreviewQuestion;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  const text = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];

  switch (q.type) {
    case "long-text":
      return (
        <textarea
          id="fk-tp-input"
          className="fk-tp-input"
          rows={4}
          placeholder={q.placeholder ?? PLACEHOLDER["long-text"]}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <input id="fk-tp-input" className="fk-tp-input" type="date" value={text} onChange={(e) => onChange(e.target.value)} />
      );
    case "dropdown":
      return (
        <select id="fk-tp-input" className="fk-tp-input" value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose one</option>
          {(q.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    case "single-choice":
    case "yes-no": {
      const opts = q.type === "yes-no" ? ["Yes", "No"] : (q.options ?? []);
      return (
        <div className="fk-tp-opts" role="radiogroup" aria-label={q.title}>
          {opts.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={text === o} onClick={() => onChange(o)}>
              <i aria-hidden>{text === o && <Check size={12} strokeWidth={3} />}</i>
              {o}
            </button>
          ))}
        </div>
      );
    }
    case "multi-choice":
      return (
        <div className="fk-tp-opts" data-multi role="group" aria-label={q.title}>
          {(q.options ?? []).map((o) => {
            const on = list.includes(o);
            return (
              <button
                key={o}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? list.filter((x) => x !== o) : [...list, o])}
              >
                <i aria-hidden>{on && <Check size={12} strokeWidth={3} />}</i>
                {o}
              </button>
            );
          })}
        </div>
      );
    case "scale": {
      const min = q.min ?? 1;
      const max = q.max ?? 5;
      const nums = Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
      return (
        <div className="fk-tp-scale" data-many={nums.length > 6 || undefined} role="radiogroup" aria-label={q.title}>
          {nums.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={text === v} onClick={() => onChange(v)}>
              {v}
            </button>
          ))}
        </div>
      );
    }
    case "rating":
      return (
        <div className="fk-tp-stars" role="radiogroup" aria-label={q.title}>
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={text === String(v)}
              aria-label={`${v} stars`}
              data-on={Number(text) >= v || undefined}
              onClick={() => onChange(String(v))}
            >
              <Star size={24} strokeWidth={1.8} />
            </button>
          ))}
        </div>
      );
    case "file":
      return (
        <span className="fk-tp-file">
          <Upload size={18} strokeWidth={2} aria-hidden />
          <b>Drop a file here, or browse</b>
          <small>Uploads work on the published form</small>
        </span>
      );
    default:
      return (
        <input
          id="fk-tp-input"
          className="fk-tp-input"
          type={q.type === "email" ? "email" : q.type === "number" ? "number" : q.type === "url" ? "url" : q.type === "phone" ? "tel" : "text"}
          placeholder={q.placeholder ?? PLACEHOLDER[q.type] ?? "Type your answer"}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
