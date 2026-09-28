"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CornerDownRight, Flag, Map as MapIcon, Play, RotateCcw, Sparkles } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { Button, Input, PillTabs, Select } from "@/components/ui";
import { applyLogic, conditionsOf, type Answer, type Rule as EvalRule } from "../../../../convex/model/logicEval";
import { computeAll } from "../../../../convex/model/calc";
import { MULTI, VALUELESS, opLabel, valueControl } from "./operators";

/**
 * The whole of a form's logic at a glance: its pages in order, what each rule
 * does to which question, where people can skip to and where they can end —
 * with the mistakes worth fixing listed underneath. The tester runs the same
 * rules the live form runs, on answers picked here.
 */

type Form = NonNullable<FunctionReturnType<typeof api.forms.get>>;
type Block = Form["blocks"][number];
type Rule = Doc<"logicRules">;

type Page = { index: number; name: string; blocks: Block[] };

function pagesOf(blocks: Block[]): Page[] {
  const pages: Page[] = [{ index: 0, name: "", blocks: [] }];
  for (const b of blocks) {
    if (b.kind === "pagebreak") pages.push({ index: pages.length, name: b.pageName ?? "", blocks: [] });
    else pages[pages.length - 1]!.blocks.push(b);
  }
  return pages.filter((p, i) => p.blocks.length > 0 || i === 0);
}

const title = (b: Block | undefined) => b?.title || "Untitled question";

type Check = { level: "warn" | "info"; rule?: string; text: string };

/** What is wrong, or likely wrong, with a form's rules. */
export function logicChecks(form: Form, rules: Rule[]): Check[] {
  const out: Check[] = [];
  const blocks = form.blocks;
  const byId = new Map(blocks.map((b) => [b._id as string, b]));
  const order = new Map(blocks.map((b, i) => [b._id as string, i]));
  const pageOf = new Map<string, number>();
  let p = 0;
  for (const b of blocks) {
    if (b.kind === "pagebreak") p++;
    else pageOf.set(b._id, p);
  }
  const calcNames = new Set((form.calc ?? []).map((c) => c.name));
  const endings = form.endings ?? [];

  for (const r of rules) {
    if (!r.enabled) continue;
    const name = r.name || "A rule";
    const conds = conditionsOf(r);
    for (const c of conds) {
      if (c.source === "calc") {
        if (!c.ref || !calcNames.has(c.ref)) out.push({ level: "warn", rule: r._id, text: `${name} reads a result that no longer exists.` });
        else if (!(c.value ?? "").trim()) out.push({ level: "warn", rule: r._id, text: `${name} compares {{${c.ref}}} with nothing yet.` });
        continue;
      }
      const q = c.blockId ? byId.get(c.blockId) : undefined;
      if (!q) {
        out.push({ level: "warn", rule: r._id, text: `${name} reads a question that was deleted, or none at all.` });
        continue;
      }
      if (c.source === "ai") {
        if (!(c.value ?? "").trim()) out.push({ level: "warn", rule: r._id, text: `${name} has an AI condition with no question for the AI.` });
        continue;
      }
      if (!VALUELESS.has(c.operator) && valueControl(q).kind !== "none" && !(c.value ?? "").trim()) {
        out.push({ level: "warn", rule: r._id, text: `${name}: “${title(q)} ${opLabel(c.operator)} …” has no value, so it never matches.` });
      }
      if (c.operator === "between" && !(c.value2 ?? "").trim()) {
        out.push({ level: "warn", rule: r._id, text: `${name}: “between” needs both ends.` });
      }
    }

    if (r.action === "ending") {
      if (!r.endingId || !endings.some((e) => e.id === r.endingId)) {
        out.push({ level: "warn", rule: r._id, text: `${name} ends on an ending that doesn’t exist.` });
      }
      continue;
    }
    const target = r.targetId ? byId.get(r.targetId) : undefined;
    if (!target) {
      out.push({ level: "warn", rule: r._id, text: `${name} doesn’t affect any question yet.` });
      continue;
    }
    const readers = conds.filter((c) => c.source !== "calc" && c.blockId).map((c) => c.blockId as string);
    const latest = Math.max(-1, ...readers.map((id) => order.get(id) ?? -1));
    if (readers.includes(target._id)) {
      out.push({ level: "warn", rule: r._id, text: `${name} reads the same question it affects.` });
    } else if (r.action !== "jump" && latest > (order.get(target._id) ?? 0)) {
      out.push({
        level: "warn",
        rule: r._id,
        text: `${name} reads an answer given after “${title(target)}”, so it can’t apply in time.`,
      });
    }
    if (r.action === "jump") {
      const from = Math.max(0, ...readers.map((id) => pageOf.get(id) ?? 0));
      const to = pageOf.get(target._id) ?? 0;
      if (to <= from) {
        out.push({
          level: "warn",
          rule: r._id,
          text: `${name} jumps back or onto the same page — a jump only ever moves forward, so it does nothing.`,
        });
      }
    }
    if (r.action === "hide-options") {
      const opts = target.type === "yes-no" ? ["Yes", "No"] : (target.options ?? []);
      if (!r.options?.length) out.push({ level: "warn", rule: r._id, text: `${name} hides no options yet.` });
      else if (opts.length && opts.every((o) => r.options!.includes(o))) {
        out.push({ level: "warn", rule: r._id, text: `${name} hides every option on “${title(target)}”.` });
      }
    }
  }

  for (const e of endings) {
    if (!rules.some((r) => r.enabled && r.action === "ending" && r.endingId === e.id)) {
      out.push({ level: "info", text: `No rule finishes on the ending “${e.name}”.` });
    }
  }
  const jumps = rules.filter((r) => r.enabled && r.action === "jump");
  if (jumps.length > 1) {
    out.push({ level: "info", text: "When more than one jump matches, the first one in the list wins." });
  }
  return out;
}

const ACTION_WORD: Record<string, string> = {
  show: "Shown only if",
  hide: "Hidden if",
  require: "Required if",
  "hide-options": "Options hidden if",
};

export function LogicMap({ form, rules }: { form: Form; rules: Rule[] }) {
  const [view, setView] = useState<"map" | "test">("map");
  const checks = useMemo(() => logicChecks(form, rules), [form, rules]);
  const warns = checks.filter((c) => c.level === "warn").length;

  return (
    <section className="fk-panel fk-lmap">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ flex: 1, margin: 0, minWidth: 160 }}>How it flows</h3>
        <PillTabs
          ariaLabel="Map or tester"
          value={view}
          onChange={setView}
          tabs={[
            { value: "map", label: "Map", icon: <MapIcon size={15} strokeWidth={1.8} aria-hidden /> },
            { value: "test", label: "Try it", icon: <Play size={15} strokeWidth={1.8} aria-hidden /> },
          ]}
        />
      </div>
      {view === "map" ? <FlowMap form={form} rules={rules} /> : <Tester form={form} rules={rules} />}
      <div className="fk-lmap-checks">
        {checks.length === 0 ? (
          <p className="fk-lmap-check" data-level="ok">
            <CheckCircle2 size={15} strokeWidth={1.8} aria-hidden />
            Nothing looks wrong with these rules.
          </p>
        ) : (
          <>
            <p className="fk-proprow-hint" style={{ margin: "0 0 6px", fontSize: 13 }}>
              {warns ? `${warns} thing${warns === 1 ? "" : "s"} to look at` : "Worth knowing"}
            </p>
            {checks.map((c, i) => (
              <p key={i} className="fk-lmap-check" data-level={c.level}>
                <AlertTriangle size={15} strokeWidth={1.8} aria-hidden />
                {c.text}
              </p>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

function FlowMap({ form, rules }: { form: Form; rules: Rule[] }) {
  const pages = pagesOf(form.blocks);
  const live = rules.filter((r) => r.enabled);
  const byId = new Map(form.blocks.map((b) => [b._id as string, b]));
  const pageOf = new Map<string, number>();
  pages.forEach((p, i) => p.blocks.forEach((b) => pageOf.set(b._id, i)));
  const endings = form.endings ?? [];

  return (
    <div className="fk-lmap-flow">
      {pages.map((p, i) => {
        const jumpsHere = live.filter((r) => {
          if (r.action !== "jump") return false;
          const readers = conditionsOf(r).map((c) => (c.blockId ? pageOf.get(c.blockId) : undefined));
          const from = Math.max(0, ...readers.filter((x): x is number => x !== undefined));
          return from === i;
        });
        return (
          <div key={i} className="fk-lmap-page">
            <div className="fk-lmap-pagehead">
              <span className="fk-lmap-pageno">{i + 1}</span>
              {p.name || `Page ${i + 1}`}
            </div>
            <ul className="fk-lmap-qs">
              {p.blocks.map((b) => {
                const on = live.filter((r) => r.targetId === b._id && r.action !== "jump" && r.action !== "ending");
                const reads = live.some((r) => conditionsOf(r).some((c) => c.blockId === b._id));
                return (
                  <li key={b._id} className="fk-lmap-q" data-hidden={b.type === "hidden" ? "true" : undefined}>
                    <span className="fk-lmap-qtitle">
                      {title(b)}
                      {b.type === "hidden" && <span className="fk-lmap-tag">hidden field</span>}
                      {reads && <span className="fk-lmap-tag" data-tone="sky">read by rules</span>}
                    </span>
                    {on.map((r) => (
                      <span key={r._id} className="fk-lmap-effect">
                        <CornerDownRight size={13} strokeWidth={1.8} aria-hidden />
                        {ACTION_WORD[r.action] ?? r.action} <Words rule={r} byId={byId} />
                        {r.action === "hide-options" && r.options?.length ? ` — hides ${r.options.join(", ")}` : ""}
                      </span>
                    ))}
                  </li>
                );
              })}
            </ul>
            {jumpsHere.map((r) => {
              const to = r.targetId ? pageOf.get(r.targetId) : undefined;
              return (
                <div key={r._id} className="fk-lmap-jump">
                  ↷ If <Words rule={r} byId={byId} />, skip to page {to !== undefined ? to + 1 : "?"} ·{" "}
                  {title(r.targetId ? byId.get(r.targetId) : undefined)}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="fk-lmap-ends">
        <span className="fk-lmap-end">
          <Flag size={14} strokeWidth={1.8} aria-hidden />
          Thank-you screen <em>everyone else</em>
        </span>
        {endings.map((e) => {
          const into = live.filter((r) => r.action === "ending" && r.endingId === e.id);
          return (
            <span key={e.id} className="fk-lmap-end" data-tone="sky">
              <Flag size={14} strokeWidth={1.8} aria-hidden />
              {e.name}
              <em>{into.length ? into.map((r) => r.name).join(", ") : "no rule yet"}</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** A rule's conditions, in a few words. */
function Words({ rule, byId }: { rule: Rule; byId: Map<string, Block> }) {
  const conds = conditionsOf(rule);
  const first = conds[0];
  if (!first) return <>—</>;
  const say = (c: typeof first) => {
    if (c.source === "ai") return `AI: ${c.value || "…"} (${c.operator === "no" ? "no" : "yes"})`;
    if (c.source === "calc") return `{{${c.ref}}} ${opLabel(c.operator)} ${c.value ?? ""}`;
    const q = c.blockId ? byId.get(c.blockId) : undefined;
    const v = VALUELESS.has(c.operator) ? "" : MULTI.has(c.operator) ? (c.value ?? "").split("|").join(", ") : (c.value ?? "");
    return `${title(q)} ${opLabel(c.operator)} ${v}${c.operator === "between" ? ` and ${c.value2 ?? ""}` : ""}`.trim();
  };
  return (
    <strong style={{ fontWeight: 500 }}>
      “{say(first)}”{conds.length > 1 ? ` + ${conds.length - 1} more` : ""}
    </strong>
  );
}

function Tester({ form, rules }: { form: Form; rules: Rule[] }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [ai, setAi] = useState<Record<string, boolean>>({});
  const live = rules.filter((r) => r.enabled);

  // Only the questions a rule reads need an answer here.
  const read = new Set<string>();
  const aiConds: { id: string; text: string; q?: Block }[] = [];
  const byId = new Map(form.blocks.map((b) => [b._id as string, b]));
  for (const r of live) {
    for (const c of conditionsOf(r)) {
      if (c.source === "ai") {
        if (c.id) aiConds.push({ id: c.id, text: c.value || "AI condition", q: c.blockId ? byId.get(c.blockId) : undefined });
      } else if (c.source !== "calc" && c.blockId) read.add(c.blockId);
    }
  }
  const calcRefs = (form.calc ?? []).length > 0;
  const inputs = form.blocks.filter((b) => b.kind === "field" && (read.has(b._id) || (calcRefs && b.key)));

  const results = useMemo(
    () => (form.calc?.length ? computeAll(form.calc, form.blocks, answers) : {}),
    [form.calc, form.blocks, answers],
  );
  const types = useMemo(() => Object.fromEntries(form.blocks.map((b) => [b._id as string, b.type])), [form.blocks]);
  const out = applyLogic(live as unknown as EvalRule[], { answers, calc: results, ai, types });

  // Walk the pages as the live form would.
  const pages = pagesOf(form.blocks).map((p) => ({
    ...p,
    shown: p.blocks.filter((b) => b.type !== "hidden" && !out.hidden.has(b._id)),
  }));
  const livePages = pages.filter((p) => p.shown.length > 0);
  const visited: number[] = [];
  const jumpPage = out.jumpTo ? livePages.findIndex((p) => p.shown.some((b) => b._id === out.jumpTo)) : -1;
  for (let at = 0; at < livePages.length && visited.length <= livePages.length; ) {
    visited.push(at);
    at = jumpPage > at ? jumpPage : at + 1;
  }
  const ending = out.ending ? form.endings?.find((e) => e.id === out.ending) : undefined;
  const set = (id: string, a: Answer | undefined) =>
    setAnswers((prev) => {
      const next = { ...prev };
      if (a) next[id] = a;
      else delete next[id];
      return next;
    });

  return (
    <div className="fk-lmap-test">
      <div className="fk-lmap-testin">
        {inputs.length === 0 && aiConds.length === 0 && (
          <p className="fk-proprow-hint" style={{ margin: 0 }}>
            No rule reads an answer yet, so there is nothing to try.
          </p>
        )}
        {inputs.map((b) => {
          const vc = valueControl(b);
          const multi = b.type === "multi-choice";
          const a = answers[b._id];
          return (
            <label key={b._id} className="fk-lmap-testq">
              <span>{title(b)}</span>
              {vc.kind === "select" && !multi ? (
                <Select
                  size="sm"
                  ariaLabel={title(b)}
                  value={a?.value ?? ""}
                  options={[{ value: "", label: "No answer" }, ...vc.options.map((o) => ({ value: o, label: o }))]}
                  onChange={(v) => set(b._id, v ? { value: v } : undefined)}
                />
              ) : vc.kind === "select" && multi ? (
                <span className="fk-optpicks">
                  {vc.options.map((o) => {
                    const on = a?.values?.includes(o) ?? false;
                    return (
                      <button
                        key={o}
                        type="button"
                        className="fk-optpick"
                        aria-pressed={on}
                        onClick={() => {
                          const cur = a?.values ?? [];
                          const next = on ? cur.filter((x) => x !== o) : [...cur, o];
                          set(b._id, next.length ? { values: next } : undefined);
                        }}
                      >
                        {o}
                      </button>
                    );
                  })}
                </span>
              ) : vc.kind === "none" ? (
                <Select
                  size="sm"
                  ariaLabel={title(b)}
                  value={a?.fileName ? "yes" : ""}
                  options={[
                    { value: "", label: "Nothing uploaded" },
                    { value: "yes", label: "Uploaded" },
                  ]}
                  onChange={(v) => set(b._id, v ? { fileName: "file" } : undefined)}
                />
              ) : (
                <Input
                  inputSize="sm"
                  aria-label={title(b)}
                  placeholder={vc.kind === "text" ? vc.placeholder : undefined}
                  value={a?.value ?? ""}
                  onChange={(e) => set(b._id, e.target.value ? { value: e.target.value } : undefined)}
                />
              )}
            </label>
          );
        })}
        {aiConds.map((c) => (
          <label key={c.id} className="fk-lmap-testq">
            <span>
              <Sparkles size={13} strokeWidth={1.8} aria-hidden style={{ display: "inline-block", marginRight: 6 }} />
              {c.text}
              {c.q ? <em> — about “{title(c.q)}”</em> : null}
            </span>
            <Select
              size="sm"
              ariaLabel={c.text}
              value={c.id in ai ? (ai[c.id] ? "yes" : "no") : ""}
              options={[
                { value: "", label: "Not asked yet (fallback)" },
                { value: "yes", label: "AI says yes" },
                { value: "no", label: "AI says no" },
              ]}
              onChange={(v) =>
                setAi((prev) => {
                  const next = { ...prev };
                  if (v) next[c.id] = v === "yes";
                  else delete next[c.id];
                  return next;
                })
              }
            />
          </label>
        ))}
        {(inputs.length > 0 || aiConds.length > 0) && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<RotateCcw size={14} strokeWidth={1.8} aria-hidden />}
              onClick={() => {
                setAnswers({});
                setAi({});
              }}
            >
              Clear answers
            </Button>
          </div>
        )}
      </div>

      <div className="fk-lmap-testout">
        <h4>What happens</h4>
        <ol className="fk-lmap-path">
          {livePages.map((p, i) => (
            <li key={p.index} data-skipped={visited.includes(i) ? undefined : "true"}>
              <strong>{p.name || `Page ${p.index + 1}`}</strong>
              <span>
                {p.shown.length} question{p.shown.length === 1 ? "" : "s"}
                {!visited.includes(i) ? " · skipped" : ""}
              </span>
            </li>
          ))}
          <li data-end="true">
            <strong>{ending ? ending.name : "Thank-you screen"}</strong>
            <span>{ending ? ending.title : "the usual one"}</span>
          </li>
        </ol>
        {out.hidden.size > 0 && (
          <p className="fk-lmap-outline">
            <b>Hidden:</b> {[...out.hidden].map((id) => title(byId.get(id))).join(", ")}
          </p>
        )}
        {out.forced.size > 0 && (
          <p className="fk-lmap-outline">
            <b>Now required:</b> {[...out.forced].map((id) => title(byId.get(id))).join(", ")}
          </p>
        )}
        {[...out.hiddenOptions].map(([id, opts]) => (
          <p key={id} className="fk-lmap-outline">
            <b>{title(byId.get(id))}:</b> {[...opts].join(", ")} hidden
          </p>
        ))}
        {Object.keys(results).length > 0 && (
          <p className="fk-lmap-outline">
            <b>Results:</b>{" "}
            {Object.entries(results)
              .map(([k, v]) => `${k} = ${Math.round(v * 100) / 100}`)
              .join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
