"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { strFromU8, unzipSync } from "fflate";
import {
  ArrowRight,
  ArrowUp,
  Check,
  ClipboardPaste,
  Copy,
  FileText,
  FileUp,
  GitBranch,
  Loader,
  Palette,
  Paperclip,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, Modal, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { FieldIcon } from "../editor/FieldIcon";
import { useFlag } from "../useFlags";
import { fieldType } from "../editor/fieldTypes";
import { THEME_PRESETS } from "../../../../convex/model/themePresets";
import { nextMonthLabel, useAsk, type Attachment } from "./AskProvider";

/* ---------- the conversation ---------- */

export function AskThread() {
  const { thread, busy, plan } = useAsk();
  const end = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [thread.length, busy]);

  return (
    <div className="fk-ask-thread" aria-live="polite">
      {thread.map((m) => (
        <div key={m.id} className="fk-ask-msg" data-from={m.from}>
          {m.from === "fk" && (
            <span className="fk-ask-mark" aria-hidden>
              <Sparkles size={13} strokeWidth={1.8} />
            </span>
          )}
          <div>
            <p>{m.text}</p>
            {m.note && <span className="fk-ask-note">{m.note}</span>}
          </div>
        </div>
      ))}
      {busy && !plan.length && (
        <div className="fk-ask-msg" data-from="fk">
          <span className="fk-ask-mark" aria-hidden>
            <Sparkles size={13} strokeWidth={1.8} />
          </span>
          <div>
            <p className="fk-ask-typing" aria-label="Formkit is writing">
              <span />
              <span />
              <span />
            </p>
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

/* ---------- the composer ---------- */

const ATTACH_ICON = { brief: ClipboardPaste, file: FileText, form: Copy } as const;

const ATTACH_ITEMS = [
  { id: "brief", icon: ClipboardPaste, label: "Paste a brief", hint: "An email or a scope document" },
  { id: "file", icon: FileUp, label: "Upload a doc", hint: "PDF, Word or plain text" },
  { id: "riff", icon: Copy, label: "Riff on a form", hint: "Start from one you already have" },
] as const;

export function AskComposer({ placeholder, autoFocus }: { placeholder?: string; autoFocus?: boolean }) {
  const ask = useAsk();
  const toast = useToast();
  // "Build from a brief" is a flag; off, there is nothing to attach.
  const canAttach = useFlag("ai.brief");
  const [value, setValue] = useState("");
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<"brief" | "riff" | null>(null);
  const [reading, setReading] = useState(false);
  const file = useRef<HTMLInputElement | null>(null);
  const box = useRef<HTMLTextAreaElement | null>(null);
  const uploadUrl = useMutation(api.users.generateUploadUrl);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      setMenu(false);
    };
    window.addEventListener("keydown", close as never);
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("keydown", close as never);
      window.removeEventListener("pointerdown", close);
    };
  }, [menu]);

  // The box grows with what is typed, up to a limit.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const submit = () => {
    if (!value.trim() || ask.busy) return;
    const text = value;
    setValue("");
    void ask.send(text);
  };

  async function readFile(f: File) {
    if (f.size > 8 * 1024 * 1024) {
      toast("That file is over 8 MB", { detail: "Paste the part that matters as a brief instead.", tone: "error" });
      return;
    }
    setReading(true);
    try {
      const name = f.name.toLowerCase();
      let attach: Attachment;
      if (name.endsWith(".pdf")) {
        const url = await uploadUrl({});
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: f });
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        attach = { kind: "file", label: f.name, storageId, mime: "application/pdf" };
      } else if (name.endsWith(".docx")) {
        // A .docx is a zip; the words are in word/document.xml.
        const files = unzipSync(new Uint8Array(await f.arrayBuffer()), { filter: (x) => x.name === "word/document.xml" });
        const xml = strFromU8(files["word/document.xml"] ?? new Uint8Array());
        const text = xml
          .replace(/<\/w:p>/g, "\n")
          .replace(/<w:tab\/>/g, " ")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        if (!text) throw new Error("There is no text in that document.");
        attach = { kind: "file", label: f.name, text };
      } else {
        attach = { kind: "file", label: f.name, text: (await f.text()).slice(0, 60000) };
      }
      ask.setAttach(attach);
      box.current?.focus();
    } catch (e) {
      toast("Could not read that file", { detail: e instanceof Error ? e.message : undefined, tone: "error" });
    } finally {
      setReading(false);
    }
  }

  function pickAttach(id: (typeof ATTACH_ITEMS)[number]["id"]) {
    if (id === "file") file.current?.click();
    else setModal(id);
  }

  const Icon = ask.attach ? ATTACH_ICON[ask.attach.kind] : Paperclip;

  return (
    <div className="fk-ask-composer">
      {ask.attach && (
        <div className="fk-ask-attached">
          <Icon size={15} strokeWidth={1.8} aria-hidden />
          <span>{ask.attach.label}</span>
          <button type="button" aria-label="Remove attachment" onClick={() => ask.setAttach(null)}>
            <X size={14} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      )}
      <div className="fk-ask-input">
        {canAttach && (
        <span style={{ position: "relative" }}>
          <button
            type="button"
            className="fk-ask-round"
            aria-label="Add something to work from"
            aria-haspopup="menu"
            aria-expanded={menu}
            disabled={reading}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setMenu((m) => !m)}
          >
            {reading ? <Loader size={17} strokeWidth={1.8} className="fk-spin" aria-hidden /> : <Paperclip size={17} strokeWidth={1.8} aria-hidden />}
          </button>
          {menu && (
            <span role="menu" aria-label="Add something" className="fk-ask-menu" onPointerDown={(e) => e.stopPropagation()}>
              {ATTACH_ITEMS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    pickAttach(a.id);
                  }}
                >
                  <span className="fk-ask-menu-icon">
                    <a.icon size={16} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span>
                    <span className="fk-ask-menu-label">{a.label}</span>
                    <span className="fk-ask-menu-hint">{a.hint}</span>
                  </span>
                </button>
              ))}
            </span>
          )}
        </span>
        )}
        <textarea
          ref={box}
          rows={1}
          value={value}
          autoFocus={autoFocus}
          aria-label="Ask Formkit"
          placeholder={placeholder ?? (ask.formId ? "Ask for a change, or describe a new form" : "Describe the form you need")}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="fk-ask-round fk-ask-send"
          aria-label="Send"
          disabled={!value.trim() || ask.busy}
          onClick={submit}
        >
          <ArrowUp size={17} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept=".pdf,.docx,.txt,.md,text/plain,application/pdf"
        aria-hidden
        tabIndex={-1}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void readFile(f);
        }}
      />
      {modal === "brief" && <BriefModal onClose={() => setModal(null)} />}
      {modal === "riff" && <RiffModal onClose={() => setModal(null)} />}
    </div>
  );
}

function BriefModal({ onClose }: { onClose: () => void }) {
  const ask = useAsk();
  const [text, setText] = useState(ask.attach?.kind === "brief" ? (ask.attach.text ?? "") : "");
  return (
    <Modal
      title="Paste a brief"
      description="An email, a scope document, notes from a call — anything that describes what you need."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={text.trim().length < 20}
            onClick={() => {
              const words = text.trim().split(/\s+/).length;
              ask.setAttach({ kind: "brief", label: `Brief · ${words} words`, text: text.trim() });
              onClose();
            }}
          >
            Use this brief
          </Button>
        </>
      }
    >
      <Textarea
        rows={10}
        autoFocus
        value={text}
        aria-label="The brief"
        placeholder="Paste it here"
        onChange={(e) => setText(e.target.value)}
      />
    </Modal>
  );
}

function RiffModal({ onClose }: { onClose: () => void }) {
  const ask = useAsk();
  const forms = useQuery(api.forms.list, { filter: "all" });
  const [pick, setPick] = useState<string | null>(null);
  const list = forms?.forms ?? [];
  return (
    <Modal
      title="Riff on a form"
      description="Formkit reads its questions and writes a new form in the same shape."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!pick}
            onClick={() => {
              const f = list.find((x) => x._id === pick);
              if (f) ask.setAttach({ kind: "form", label: f.title, formId: f._id });
              onClose();
            }}
          >
            Use this form
          </Button>
        </>
      }
    >
      {list.length ? (
        <Select
          searchable
          ariaLabel="Which form"
          placeholder="Choose a form"
          value={pick}
          onChange={setPick}
          options={list.map((f) => ({ value: f._id, label: f.title, note: `${f.questions} questions` }))}
        />
      ) : (
        <p className="fk-ask-quiet">You have no forms yet to start from.</p>
      )}
    </Modal>
  );
}

/* ---------- credits ---------- */

export function AskCredits({ compact }: { compact?: boolean }) {
  const { left, limit, setLimitOpen } = useAsk();
  const ticks = Math.min(limit, 20);
  const lit = limit ? Math.round((left / limit) * ticks) : 0;
  return (
    <div className="fk-ask-credits" data-compact={compact ? "true" : undefined}>
      <div className="fk-ask-credits-row">
        <span className="fk-ask-credits-left">
          {left} of {limit} form {limit === 1 ? "credit" : "credits"} left
        </span>
        {!compact && <span className="fk-ask-quiet">Resets on {nextMonthLabel()}</span>}
        <button type="button" className="fk-ask-link" onClick={() => setLimitOpen(true)}>
          How credits work
        </button>
      </div>
      <div className="fk-ask-ticks" aria-hidden>
        {Array.from({ length: ticks }, (_, i) => (
          <span key={i} data-on={i < lit ? "true" : undefined} />
        ))}
      </div>
    </div>
  );
}

/** What credits are, and what to do when they run out. No plans, no prices. */
export function AskLimitModal() {
  const { left, limit, limitOpen, setLimitOpen } = useAsk();
  if (!limitOpen) return null;
  const out = left <= 0;
  return (
    <Modal
      title={out ? "That is this month's forms" : "How credits work"}
      description={
        out
          ? `You have built ${limit} ${limit === 1 ? "form" : "forms"} with Ask Formkit this month.`
          : `You have ${left} of ${limit} left this month.`
      }
      onClose={() => setLimitOpen(false)}
      footer={<Button onClick={() => setLimitOpen(false)}>Got it</Button>}
    >
      <div className="fk-ask-limit">
        <p>Building a whole new form spends one credit. Everything else is free and does not count:</p>
        <ul>
          <li>Changing a draft before you open it</li>
          <li>Adding questions to a form</li>
          <li>Rewriting questions in another tone</li>
          <li>Writing logic rules and picking a theme</li>
          <li>Reading what the responses say</li>
        </ul>
        <p>
          Credits come back on {nextMonthLabel()}. If you need more before then, ask your Formkit admin — they can add
          them to your account.
        </p>
      </div>
    </Modal>
  );
}

/* ---------- the canvas ---------- */

export function AskCanvas({ inline }: { inline?: boolean }) {
  const ask = useAsk();
  const { canvas, plan, shown, busy } = ask;

  if (busy && plan.length) {
    return (
      <div className="fk-ask-plan">
        <span className="fk-ask-quiet">Working</span>
        {plan.map((p, i) => {
          const active = !p.done && (i === 0 || plan[i - 1]!.done);
          return (
            <div key={p.text} className="fk-ask-step" data-state={p.done ? "done" : active ? "active" : "todo"}>
              <span aria-hidden>
                {p.done ? <Check size={13} strokeWidth={2.2} /> : active ? <Loader size={13} strokeWidth={2} className="fk-spin" /> : null}
              </span>
              {p.text}
            </div>
          );
        })}
        <p className="fk-ask-quiet">A few seconds — every question is written from scratch.</p>
      </div>
    );
  }

  if (!canvas) {
    if (inline) return null;
    return (
      <div className="fk-ask-blank">
        <span aria-hidden>
          <Sparkles size={18} strokeWidth={1.8} />
        </span>
        <p>Whatever Formkit builds or changes shows up here.</p>
      </div>
    );
  }

  const reveal = (i: number) => (i < shown ? "true" : undefined);

  switch (canvas.kind) {
    case "draft": {
      const d = canvas.draft;
      const n = d.items.filter((i) => i.kind === "field").length;
      let q = 0;
      return (
        <div className="fk-ask-card">
          <div className="fk-ask-card-head">
            <div>
              <div className="fk-ask-card-title">{d.title}</div>
              <div className="fk-ask-quiet">
                {n} {n === 1 ? "question" : "questions"}
                {d.rules.length ? ` · ${d.rules.length} ${d.rules.length === 1 ? "rule" : "rules"}` : ""}
                {d.theme ? ` · ${THEME_PRESETS.find((t) => t.id === d.theme)?.name ?? d.theme} theme` : ""}
              </div>
            </div>
            <Badge tone="draft">Draft</Badge>
          </div>
          {d.description && <p className="fk-ask-desc">{d.description}</p>}
          <ol className="fk-ask-rows">
            {d.items.map((it, i) =>
              it.kind === "pagebreak" ? (
                <li key={i} className="fk-ask-page" data-in={reveal(i)}>
                  <span>{it.pageName}</span>
                </li>
              ) : (
                <li key={i} className="fk-ask-row" data-in={reveal(i)}>
                  <span className="fk-ask-num">{++q}</span>
                  <span className="fk-ask-icon">
                    <FieldIcon name={fieldType(it.type).icon} size={15} />
                  </span>
                  <span className="fk-ask-row-body">
                    <span>
                      {it.title}
                      {it.required && <span className="fk-ask-req"> *</span>}
                    </span>
                    {it.help && <span className="fk-ask-help">{it.help}</span>}
                    {it.options && <span className="fk-ask-help">{it.options.join(" · ")}</span>}
                  </span>
                  <span className="fk-ask-type">{fieldType(it.type).label}</span>
                </li>
              ),
            )}
            {shown < d.items.length && (
              <li className="fk-ask-ghost" aria-hidden>
                <span />
                <span />
              </li>
            )}
          </ol>
          {d.rules.length > 0 && (
            <div className="fk-ask-sub">
              <span className="fk-ask-quiet">
                <GitBranch size={13} strokeWidth={1.8} aria-hidden /> Logic
              </span>
              {d.rules.map((r, i) => {
                const fields = d.items.filter((it) => it.kind === "field");
                const name = (n: number) => {
                  const f = fields[n - 1];
                  return f && f.kind === "field" ? f.title : `question ${n}`;
                };
                return (
                  <span key={i} className="fk-ask-help">
                    <strong>{r.name}</strong> — {r.action} “{name(r.target)}” when “{name(r.when)}”{" "}
                    {r.operator.replace(/-/g, " ")}
                    {r.value ? ` ${r.value}` : ""}
                  </span>
                );
              })}
            </div>
          )}
          <div className="fk-ask-actions">
            <Button iconRight={<ArrowRight size={16} strokeWidth={1.8} aria-hidden />} onClick={() => void ask.commit()}>
              Open in builder
            </Button>
            <Button variant="secondary" onClick={ask.discard}>
              Discard
            </Button>
          </div>
          <div className="fk-ask-chips">
            {["Make it shorter", "Add a question about budget", "Make it warmer", "Add logic"].map((c) => (
              <button key={c} type="button" disabled={ask.busy} onClick={() => void ask.send(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "added":
      return (
        <div className="fk-ask-card">
          <div>
            <div className="fk-ask-quiet">Added to</div>
            <div className="fk-ask-card-title">{canvas.title}</div>
          </div>
          <ol className="fk-ask-rows">
            {canvas.items.map((it, i) => (
              <li key={i} className="fk-ask-row" data-in={reveal(i)}>
                <span className="fk-ask-icon">
                  <FieldIcon name={fieldType(it.type).icon} size={15} />
                </span>
                <span className="fk-ask-row-body">
                  <span>{it.title}</span>
                  {it.options && <span className="fk-ask-help">{it.options.join(" · ")}</span>}
                </span>
                <span className="fk-ask-type">{fieldType(it.type).label}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "rules":
      return (
        <div className="fk-ask-card">
          <div>
            <div className="fk-ask-quiet">Logic on</div>
            <div className="fk-ask-card-title">{canvas.title}</div>
          </div>
          {canvas.items.map((r, i) => (
            <div key={i} className="fk-ask-rule" data-in={reveal(i)}>
              <div className="fk-ask-rule-name">{r.name}</div>
              <div className="fk-ask-help">
                When <strong>{r.when}</strong> {r.operator}
                {r.value ? (
                  <>
                    {" "}
                    <strong>{r.value}</strong>
                  </>
                ) : null}
                , {r.action} <strong>{r.target}</strong>
              </div>
            </div>
          ))}
        </div>
      );
    case "theme":
      return (
        <div className="fk-ask-card">
          <div>
            <div className="fk-ask-quiet">
              <Palette size={13} strokeWidth={1.8} aria-hidden /> Theme on {canvas.title}
            </div>
            <div className="fk-ask-card-title">{canvas.name}</div>
          </div>
          <div className="fk-ask-swatches" aria-hidden>
            {canvas.swatches.map((c, i) => (
              <span key={i} style={{ background: c }} />
            ))}
          </div>
          <p className="fk-ask-quiet">Change it any time on the Design tab.</p>
        </div>
      );
    case "diff":
      return (
        <div className="fk-ask-card">
          <div>
            <div className="fk-ask-quiet">Rewritten {canvas.mode}</div>
            <div className="fk-ask-card-title">{canvas.title}</div>
          </div>
          <div className="fk-ask-diff">
            {canvas.items.map((d, i) => (
              <div key={d.blockId} data-in={reveal(i)}>
                <div className="fk-ask-before">{d.before}</div>
                <div>{d.after}</div>
              </div>
            ))}
          </div>
          {canvas.applied ? (
            <div className="fk-ask-applied">
              <Check size={15} strokeWidth={2} aria-hidden /> Applied. Every question above has been updated.
            </div>
          ) : (
            <div className="fk-ask-actions">
              <Button iconLeft={<Check size={16} strokeWidth={1.8} aria-hidden />} onClick={() => void ask.applyRewrite()}>
                Apply rewrite
              </Button>
              <Button variant="secondary" onClick={ask.discard}>
                Keep as is
              </Button>
            </div>
          )}
        </div>
      );
    case "insight":
      return (
        <div className="fk-ask-card">
          <div>
            <div className="fk-ask-quiet">Responses</div>
            <div className="fk-ask-card-title">{canvas.title}</div>
          </div>
          {canvas.items.map((l, i) => (
            <div key={i} className="fk-ask-stat" data-in={reveal(i)}>
              <div>
                <span>{l.k}</span>
                <strong>{l.v}</strong>
              </div>
              <span className="fk-ask-help">{l.n}</span>
            </div>
          ))}
        </div>
      );
  }
}

/** The form being worked on, when there is a choice to make. */
export function AskTarget() {
  const ask = useAsk();
  const forms = useQuery(api.forms.list, { filter: "all" });
  return (
    <Select
      size="sm"
      searchable
      ariaLabel="What to work on"
      value={ask.formId ?? "new"}
      onChange={ask.setTarget}
      options={[
        { value: "new", label: "A new form" },
        ...(forms?.forms ?? []).map((f) => ({ value: f._id, label: f.title, note: `${f.questions} questions` })),
      ]}
    />
  );
}
