"use client";

import { useSeededQuery } from "@/lib/seed";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Check, Flag, Plus, Sparkles, Trash2, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Button, IconButton, Segmented, Select, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { DraftArea, DraftInput, DraftPill } from "./Draft";
import { CALC_OPS, MULTI, VALUELESS, firstValue, opLabel, opsFor, valueControl } from "./operators";
import { tracked } from "./saveStatus";
import type { FunctionReturnType } from "convex/server";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, upgradeOnPlanError, useGate } from "@/components/plan/usePlan";
import { errorText } from "../settings/bits";
import { unknownKeys } from "../../../../convex/model/calc";
import { groupsOf } from "../../../../convex/model/logicEval";
import { LogicMap } from "./LogicMap";

/**
 * Conditional logic. Show, hide or require a question, jump ahead, hide some
 * of a question's options, or finish on a particular ending - based on the
 * answers so far. Rules run top to bottom.
 *
 * A rule is one or more groups of conditions: each group joins its own with
 * AND or OR, and the groups are joined the same way - "(a and b) or c". A
 * condition reads an answer, a calculation's result, or (Business) asks the
 * AI a yes-or-no question about an answer.
 *
 * The comparisons and the way a value is picked follow what is being tested,
 * so "18 or older" is "is at least 18" on a number and a choice question
 * offers its own options rather than a text box.
 */

type Rule = Doc<"logicRules">;
type Condition = Rule["conditions"][number];
type Group = { join: "and" | "or"; conditions: Condition[] };
type Form = NonNullable<FunctionReturnType<typeof api.forms.get>>;
type Block = Form["blocks"][number];

const ACTIONS = [
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
  { value: "require", label: "Require" },
  { value: "jump", label: "Jump to" },
  { value: "hide-options", label: "Hide options on" },
  { value: "ending", label: "End with" },
] as const;
const ADVANCED = new Set(["hide-options", "ending"]);

const short = (t: string | null | undefined, n = 40) => {
  const s = t || "Untitled question";
  return s.length > n ? `${s.slice(0, n - 2)}…` : s;
};

export function LogicTab({ formId }: { formId: Id<"forms"> }) {
  const toast = useToast();
  const form = useSeededQuery(api.forms.get, { formId });
  const rules = useQuery(api.logic.list, { formId });
  const add = useMutation(api.logic.add);

  if (!form) return null;

  const questions = form.blocks.filter((b) => b.kind === "field");

  async function addRule() {
    const f0 = questions[0];
    const f1 = questions[1] ?? f0;
    await tracked(
      add({
        formId,
        action: "show",
        targetId: f1?._id,
        conditions: [{ blockId: f0?._id, operator: "is", value: firstValue(f0) }],
      }),
    );
    toast("Rule added", { detail: "Name it and finish the condition" });
  }

  const addButton = (
    <Button
      iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />}
      disabled={questions.length < 2}
      onClick={addRule}
    >
      Add rule
    </Button>
  );

  return (
    <div className="fk-logic">
      <section className="fk-panel fk-logic-head">
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 style={{ margin: "0 0 6px" }}>Conditional logic</h3>
          <p className="fk-panel-lede" style={{ margin: 0 }}>
            Show, hide or require a question, skip ahead, hide options or pick the ending, based on the answers so
            far. Rules run top to bottom.
          </p>
        </div>
        {addButton}
      </section>

      {questions.length < 2 && (
        <div className="fk-note">
          <span>
            Logic needs at least two questions: one to answer, one to affect. Add another under
            Build.
          </span>
        </div>
      )}


      {questions.length >= 2 && <DescribeRule formId={formId} form={form} />}

      {rules && rules.length > 0 && <LogicMap form={form} rules={rules} />}

      {(rules ?? []).map((rule, i) => (
        <RuleCard key={rule._id} rule={rule} index={i} form={form} />
      ))}

      <Endings formId={formId} form={form} rules={rules ?? []} />
      <Calculations formId={formId} form={form} />
    </div>
  );
}

function RuleCard({ rule, index, form }: { rule: Rule; index: number; form: Form }) {
  const toast = useToast();
  const update = useMutation(api.logic.update);
  const remove = useMutation(api.logic.remove);
  const advanced = useGate("logic.advanced", form.ownerPlan?.features);

  const questions = form.blocks.filter((b) => b.kind === "field");
  const byId = (id?: string | null) => questions.find((q) => q._id === id);
  const questionOptions = questions.map((q) => ({ value: q._id as string, label: short(q.title) }));
  const choiceQuestions = questions.filter((q) => (q.options?.length ?? 0) > 0 || q.type === "yes-no");
  const endings = form.endings ?? [];

  const patch = async (p: Parameters<typeof update>[0]["patch"]) => {
    try {
      await tracked(update({ ruleId: rule._id, patch: p }));
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That change did not save."));
    }
  };

  const grouped = !!rule.groups?.length;
  const groups: Group[] = groupsOf(rule) as Group[];

  /** Saves the groups, folding back to a plain list when only one is left. */
  const setGroups = (next: Group[]) => {
    if (next.length === 1) {
      return patch({ ...(grouped ? { groups: null } : {}), conditions: next[0]!.conditions, join: next[0]!.join });
    }
    return patch({ groups: next, conditions: next[0]!.conditions, ...(grouped ? {} : { join: "or" as const }) });
  };

  const newCondition = (): Condition => {
    const q = questions.find((x) => x._id !== rule.targetId) ?? questions[0];
    return { blockId: q?._id, operator: opsFor(q)[0]!.value === "is" ? "is" : opsFor(q)[0]!.value, value: firstValue(q) };
  };

  const target = byId(rule.targetId);
  const ending = endings.find((e) => e.id === rule.endingId);
  const optionsOf = (q: Block | undefined) => (q?.type === "yes-no" ? ["Yes", "No"] : (q?.options ?? []));

  return (
    <section className="fk-panel fk-rule" data-off={rule.enabled ? undefined : "true"}>
      <div className="fk-rule-head">
        <span className="fk-rule-no">{String(index + 1).padStart(2, "0")}</span>
        <DraftInput
          className="fk-rule-name"
          aria-label="Rule name"
          title="Click to rename"
          placeholder="Name this rule"
          value={rule.name}
          onCommit={(name) => patch({ name })}
        />
        <span className="fk-proprow-hint" style={{ margin: 0, fontSize: 13.5 }}>
          {rule.enabled ? "On" : "Off"}
        </span>
        <Switch
          checked={rule.enabled}
          label={`${rule.name || "This rule"} is on`}
          onChange={async (on) => {
            await patch({ enabled: on });
            toast(on ? "Rule applied" : "Rule paused", { detail: rule.name });
          }}
        />
        <IconButton
          label="Delete rule"
          onClick={async () => {
            await tracked(remove({ ruleId: rule._id }));
            toast("Rule removed", { detail: rule.name });
          }}
        >
          <Trash2 size={16} strokeWidth={1.8} aria-hidden />
        </IconButton>
      </div>

      {groups.map((g, gi) => {
        const setGroup = (next: Group) => setGroups(groups.map((x, j) => (j === gi ? next : x)));
        const body = (
          <>
            {g.conditions.map((c, k) => (
              <ConditionRow
                key={c.id ?? k}
                c={c}
                lead={k === 0 ? (gi === 0 || grouped ? "If" : "") : g.join === "or" ? "Or" : "And"}
                form={form}
                onChange={(next) =>
                  setGroup({ ...g, conditions: g.conditions.map((x, j) => (j === k ? next : x)) })
                }
                onRemove={
                  g.conditions.length > 1
                    ? () => setGroup({ ...g, conditions: g.conditions.filter((_, j) => j !== k) })
                    : groups.length > 1
                      ? () => setGroups(groups.filter((_, j) => j !== gi))
                      : undefined
                }
              />
            ))}
            <div className="fk-rule-adds">
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<Plus size={15} strokeWidth={1.8} aria-hidden />}
                onClick={() => void setGroup({ ...g, conditions: [...g.conditions, newCondition()] })}
              >
                Add condition
              </Button>
              {g.conditions.length > 1 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <Segmented
                    ariaLabel="How these conditions combine"
                    size="sm"
                    value={g.join}
                    onChange={(join) => void setGroup({ ...g, join })}
                    options={[
                      { value: "and", label: "AND" },
                      { value: "or", label: "OR" },
                    ]}
                  />
                  <span className="fk-proprow-hint" style={{ margin: 0, fontSize: 13 }}>
                    {g.join === "or" ? "Any one is enough" : "Every one has to hold"}
                  </span>
                </span>
              )}
            </div>
          </>
        );
        return (
          <div key={gi}>
            {gi > 0 && (
              <div className="fk-rule-between">
                <Segmented
                  ariaLabel="How the groups combine"
                  size="sm"
                  value={rule.join}
                  onChange={(join) => void patch({ join })}
                  options={[
                    { value: "or", label: "OR" },
                    { value: "and", label: "AND" },
                  ]}
                />
                <span className="fk-proprow-hint" style={{ margin: 0, fontSize: 13 }}>
                  {rule.join === "or" ? "Either group is enough" : "Both groups have to hold"}
                </span>
              </div>
            )}
            {grouped ? (
              <div className="fk-rule-group">
                <div className="fk-rule-group-head">
                  <span>Group {gi + 1}</span>
                  <IconButton label="Remove this group" onClick={() => void setGroups(groups.filter((_, j) => j !== gi))}>
                    <X size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                </div>
                {body}
              </div>
            ) : (
              body
            )}
          </div>
        );
      })}

      <div className="fk-rule-adds" style={{ marginLeft: 0, marginBottom: 16 }}>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Plus size={15} strokeWidth={1.8} aria-hidden />}
          onClick={() => void setGroups([...groups, { join: "and", conditions: [newCondition()] }])}
        >
          Add a group
        </Button>
        <span className="fk-proprow-hint" style={{ margin: 0, fontSize: 13 }}>
          For “(this and that) or something else”.
        </span>
      </div>

      <div className="fk-rule-row">
        <span className="fk-rule-chip" data-tone="sky">
          Then
        </span>
        <div style={{ flex: "0 0 auto", width: 170 }}>
          <Select
            size="sm"
            ariaLabel="What happens"
            value={rule.action}
            options={ACTIONS.map((a) => ({
              value: a.value,
              label: a.label,
              note: ADVANCED.has(a.value) && advanced.locked ? "Pro" : undefined,
            }))}
            onChange={(v) => {
              if (ADVANCED.has(v) && advanced.locked) return openUpgrade({ feature: "logic.advanced" });
              const action = v as Rule["action"];
              if (action === "ending") return void patch({ action, endingId: rule.endingId ?? endings[0]?.id });
              if (action === "hide-options") {
                const q = choiceQuestions.find((x) => x._id === rule.targetId) ?? choiceQuestions[0];
                return void patch({ action, ...(q ? { targetId: q._id } : {}), options: [] });
              }
              void patch({ action });
            }}
          />
        </div>
        {rule.action === "ending" ? (
          endings.length ? (
            <div style={{ flex: "1 1 220px", minWidth: 180 }}>
              <Select
                size="sm"
                ariaLabel="Which ending"
                placeholder="Pick an ending"
                value={rule.endingId ?? null}
                options={endings.map((e) => ({ value: e.id, label: e.name }))}
                onChange={(endingId) => void patch({ endingId })}
              />
            </div>
          ) : (
            <span className="fk-proprow-hint" style={{ margin: 0, fontSize: 13.5 }}>
              Add an ending under Endings below first.
            </span>
          )
        ) : (
          <div style={{ flex: "1 1 220px", minWidth: 180 }}>
            <Select
              size="sm"
              ariaLabel="Which question is affected"
              placeholder="Pick a question"
              value={(rule.targetId as string | undefined) ?? null}
              options={
                rule.action === "hide-options"
                  ? choiceQuestions.map((q) => ({ value: q._id as string, label: short(q.title) }))
                  : questionOptions
              }
              onChange={(v) =>
                void patch({ targetId: v as Id<"blocks">, ...(rule.action === "hide-options" ? { options: [] } : {}) })
              }
            />
          </div>
        )}
      </div>
      {rule.action === "hide-options" && target && (
        <div className="fk-rule-row" style={{ paddingLeft: 54 }}>
          <OptionPicks
            options={optionsOf(target)}
            picked={rule.options ?? []}
            onChange={(options) => void patch({ options })}
          />
          {(rule.options?.length ?? 0) >= optionsOf(target).length && optionsOf(target).length > 0 && (
            <p className="fk-rule-note" data-bad="true" style={{ padding: 0, margin: 0, flexBasis: "100%" }}>
              This hides every option, so the question can’t be answered. Leave at least one.
            </p>
          )}
        </div>
      )}

      <div className="fk-rulecard-sentence" style={{ marginTop: 18, background: "var(--neutral-50)" }}>
        {groups.map((g, gi) => (
          <span key={gi} style={{ display: "contents" }}>
            {gi > 0 && <span className="fk-rw">{rule.join === "or" ? "or" : "and"}</span>}
            {groups.length > 1 && <span className="fk-rw">(</span>}
            {g.conditions.map((c, k) => (
              <span key={k} style={{ display: "contents" }}>
                <span className="fk-rw">{k === 0 ? (gi === 0 ? "If" : "") : g.join === "or" ? "or" : "and"}</span>
                <ConditionWords c={c} form={form} />
              </span>
            ))}
            {groups.length > 1 && <span className="fk-rw">)</span>}
          </span>
        ))}
        <span className="fk-rw">then</span>
        <span className="fk-rchip" data-tone="sky">
          {ACTIONS.find((a) => a.value === rule.action)?.label}
        </span>
        {rule.action === "ending" ? (
          <span className="fk-rchip">{ending?.name || "…"}</span>
        ) : (
          <span className="fk-rchip">{target?.title || "…"}</span>
        )}
        {rule.action === "hide-options" && (
          <span className="fk-rchip" data-tone="ink">
            {rule.options?.length ? rule.options.join(", ") : "…"}
          </span>
        )}
      </div>
    </section>
  );
}

type Proposal = FunctionReturnType<typeof api.aiLogic.describe>["rules"][number];

/**
 * Plain words in, rules out: the AI proposes, the owner reads each one and
 * adds the ones they want. Nothing is saved until they do.
 */
function DescribeRule({ formId, form }: { formId: Id<"forms">; form: Form }) {
  const toast = useToast();
  const viewer = useSeededQuery(api.users.viewer, {});
  const describe = useAction(api.aiLogic.describe);
  const add = useMutation(api.logic.add);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ rules: Proposal[]; note?: string } | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());

  if (!viewer?.ai.allowed) return null;

  async function go() {
    setBusy(true);
    setFound(null);
    setAdded(new Set());
    try {
      setFound(await describe({ formId, text }));
    } catch (e) {
      toast(errorText(e, "That didn’t work. Try again in a minute."));
    } finally {
      setBusy(false);
    }
  }

  async function take(p: Proposal, i: number) {
    try {
      const one = p.groups.length === 1;
      await tracked(
        add({
          formId,
          name: p.name,
          join: one ? p.groups[0]!.join : p.join,
          action: p.action,
          targetId: p.targetId,
          conditions: p.groups[0]!.conditions,
          groups: one ? undefined : p.groups,
          options: p.options,
          endingId: p.endingId,
        }),
      );
      setAdded((s) => new Set(s).add(i));
      toast("Rule added", { detail: p.name });
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That rule did not save."));
    }
  }

  const byId = new Map(form.blocks.map((b) => [b._id as string, b]));
  return (
    <section className="fk-panel fk-describe">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Sparkles size={17} strokeWidth={1.8} aria-hidden style={{ display: "inline-block" }} />
        <h3 style={{ flex: 1, margin: 0 }}>Describe a rule</h3>
      </div>
      <p className="fk-panel-lede">
        Say what should happen in your own words, and check the rules it writes before adding them.
      </p>
      <form
        className="fk-describe-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 6 && !busy) void go();
        }}
      >
        <span className="ui-input-wrap" data-size="md" style={{ flex: 1, minWidth: 0 }}>
          <input
            aria-label="What should happen"
            placeholder="e.g. If the budget is over £20k and they found us on Instagram, skip to the call booking page"
            value={text}
            maxLength={1200}
            onChange={(e) => setText(e.target.value)}
          />
        </span>
        <Button type="submit" disabled={busy || text.trim().length < 6}>
          {busy ? "Writing…" : "Write rules"}
        </Button>
      </form>
      {found && (
        <div className="fk-describe-out">
          {found.rules.map((p, i) => (
            <div key={i} className="fk-describe-card">
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{p.name}</strong>
                {p.explain && <p>{p.explain}</p>}
                <div className="fk-rulecard-sentence" style={{ marginTop: 8 }}>
                  {p.groups.map((g, gi) => (
                    <span key={gi} style={{ display: "contents" }}>
                      {gi > 0 && <span className="fk-rw">{p.join}</span>}
                      {g.conditions.map((c, k) => (
                        <span key={k} style={{ display: "contents" }}>
                          <span className="fk-rw">{k === 0 ? (gi === 0 ? "If" : "") : g.join}</span>
                          <ConditionWords c={c as Condition} form={form} />
                        </span>
                      ))}
                    </span>
                  ))}
                  <span className="fk-rw">then</span>
                  <span className="fk-rchip" data-tone="sky">
                    {ACTIONS.find((a) => a.value === p.action)?.label}
                  </span>
                  <span className="fk-rchip">
                    {p.action === "ending"
                      ? (form.endings ?? []).find((e) => e.id === p.endingId)?.name
                      : byId.get(p.targetId ?? "")?.title}
                  </span>
                  {p.options?.length ? (
                    <span className="fk-rchip" data-tone="ink">
                      {p.options.join(", ")}
                    </span>
                  ) : null}
                </div>
              </div>
              {added.has(i) ? (
                <span className="fk-describe-added">
                  <Check size={15} strokeWidth={2} aria-hidden style={{ display: "inline-block" }} /> Added
                </span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => void take(p, i)}>
                  Add rule
                </Button>
              )}
            </div>
          ))}
          {found.note && <p className="fk-proprow-hint" style={{ margin: 0 }}>{found.note}</p>}
        </div>
      )}
    </section>
  );
}

/** A condition as words, for the sentence under a rule. */
function ConditionWords({ c, form }: { c: Condition; form: Form }) {
  const q = form.blocks.find((b) => b._id === c.blockId);
  if (c.source === "ai") {
    return (
      <>
        <span className="fk-rchip" data-tone="ai">
          <Sparkles size={12} strokeWidth={2} aria-hidden style={{ display: "inline-block", marginRight: 4 }} />
          {c.value || "…"}
        </span>
        <span className="fk-rw">about</span>
        <span className="fk-rchip">{q?.title || "…"}</span>
        <span className="fk-rw">{c.operator === "no" ? "is no" : "is yes"}</span>
      </>
    );
  }
  const subject = c.source === "calc" ? `{{${c.ref ?? "result"}}}` : q?.title || "…";
  const valued = !VALUELESS.has(c.operator) && (c.source === "calc" || valueControl(q).kind !== "none");
  const value = MULTI.has(c.operator) ? (c.value ?? "").split("|").filter(Boolean).join(", ") : c.value;
  return (
    <>
      <span className="fk-rchip">{subject}</span>
      <span className="fk-rw">{opLabel(c.operator)}</span>
      {valued && (
        <span className="fk-rchip" data-tone="ink">
          {value || "…"}
          {c.operator === "between" ? ` and ${c.value2 || "…"}` : ""}
        </span>
      )}
    </>
  );
}

/** Pick several of a question's options, as toggles. */
function OptionPicks({
  options,
  picked,
  onChange,
}: {
  options: string[];
  picked: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <span className="fk-optpicks" role="group">
      {options.map((o) => {
        const on = picked.includes(o);
        return (
          <button
            key={o}
            type="button"
            className="fk-optpick"
            aria-pressed={on}
            onClick={() => onChange(on ? picked.filter((p) => p !== o) : [...picked, o])}
          >
            {o}
          </button>
        );
      })}
    </span>
  );
}

const SOURCES = [
  { value: "answer", label: "An answer" },
  { value: "calc", label: "A result" },
  { value: "ai", label: "AI decides" },
];

function ConditionRow({
  c,
  lead,
  form,
  onChange,
  onRemove,
}: {
  c: Condition;
  lead: string;
  form: Form;
  onChange: (next: Condition) => void;
  onRemove?: () => void;
}) {
  const ai = useGate("logic.ai", form.ownerPlan?.features);
  const calc = form.calc ?? [];
  const questions = form.blocks.filter((b) => b.kind === "field");
  const questionOptions = questions.map((q) => ({ value: q._id as string, label: short(q.title) }));
  const q = questions.find((x) => x._id === c.blockId);
  const source = c.source ?? "answer";
  const set = (next: Partial<Condition>) => onChange({ ...c, ...next });

  const sourcePick = (
    <div style={{ flex: "0 0 auto", width: 132 }}>
      <Select
        size="sm"
        ariaLabel="What the condition reads"
        value={source}
        options={SOURCES.filter((s) => s.value !== "calc" || calc.length > 0).map((s) => ({
          ...s,
          note: s.value === "ai" && ai.locked ? "Business" : undefined,
        }))}
        onChange={(v) => {
          if (v === source) return;
          if (v === "ai") {
            if (ai.locked) return openUpgrade({ feature: "logic.ai" });
            const b = q ?? questions.find((x) => ["short-text", "long-text"].includes(x.type ?? "")) ?? questions[0];
            return onChange({ id: c.id, source: "ai", blockId: b?._id, operator: "yes", value: "", fallback: false });
          }
          if (v === "calc") {
            return onChange({ id: c.id, source: "calc", ref: calc[0]?.name, operator: "at-least", value: "" });
          }
          const b = q ?? questions[0];
          onChange({ id: c.id, blockId: b?._id, operator: opsFor(b)[0]!.value, value: firstValue(b) });
        }}
      />
    </div>
  );

  const remove = onRemove && (
    <IconButton label="Remove this condition" onClick={onRemove}>
      <X size={15} strokeWidth={1.8} aria-hidden />
    </IconButton>
  );
  const chip = <span className="fk-rule-chip" data-empty={lead ? undefined : "true"}>{lead || "·"}</span>;

  if (source === "ai") {
    return (
      <div>
        <div className="fk-rule-row">
          {chip}
          {sourcePick}
          <div style={{ flex: "1 1 200px", minWidth: 170 }}>
            <Select
              size="sm"
              ariaLabel="Which answer the AI reads"
              placeholder="Pick a question"
              value={(c.blockId as string | undefined) ?? null}
              options={questionOptions}
              onChange={(v) => set({ blockId: v as Id<"blocks"> })}
            />
          </div>
          <div style={{ flex: "0 0 auto", width: 150 }}>
            <Select
              size="sm"
              ariaLabel="Which way the AI answers"
              value={c.operator === "no" ? "no" : "yes"}
              options={[
                { value: "yes", label: "AI says yes" },
                { value: "no", label: "AI says no" },
              ]}
              onChange={(operator) => set({ operator })}
            />
          </div>
          {remove}
        </div>
        <div className="fk-rule-row" style={{ paddingLeft: 54 }}>
          <DraftPill
            aria-label="What to ask the AI"
            placeholder="e.g. Does this mention a budget over $10,000?"
            value={c.value ?? ""}
            wrapStyle={{ flex: "1 1 280px", minWidth: 220 }}
            icon={<Sparkles size={14} strokeWidth={1.8} aria-hidden style={{ marginLeft: 10, flex: "0 0 auto" }} />}
            onCommit={(value) => set({ value })}
          />
          <div style={{ flex: "0 0 auto", width: 200 }}>
            <Select
              size="sm"
              ariaLabel="What to assume until the AI answers"
              value={c.fallback ? "yes" : "no"}
              options={[
                { value: "no", label: "Until then, assume no" },
                { value: "yes", label: "Until then, assume yes" },
              ]}
              onChange={(v) => set({ fallback: v === "yes" })}
            />
          </div>
        </div>
        <p className="fk-rule-note">
          The AI reads the answer when its page is finished and answers yes or no. If it can’t, or your monthly AI checks
          run out, the form goes with what you chose to assume.
        </p>
      </div>
    );
  }

  if (source === "calc") {
    const bad = (x?: string) => (x ?? "").trim() !== "" && !/^-?\d+(\.\d+)?$/.test((x ?? "").trim());
    return (
      <div className="fk-rule-row">
        {chip}
        {sourcePick}
        <div style={{ flex: "1 1 160px", minWidth: 140 }}>
          <Select
            size="sm"
            ariaLabel="Which result"
            placeholder="Pick a result"
            value={c.ref ?? null}
            options={calc.map((x) => ({ value: x.name, label: x.name }))}
            onChange={(ref) => set({ ref })}
          />
        </div>
        <div style={{ flex: "0 0 auto", width: 170 }}>
          <Select size="sm" ariaLabel="Comparison" value={c.operator} options={CALC_OPS} onChange={(operator) => set({ operator })} />
        </div>
        <DraftPill
          aria-label="Number"
          aria-invalid={bad(c.value)}
          inputMode="decimal"
          placeholder="e.g. 10"
          value={c.value ?? ""}
          wrapStyle={{ flex: "0 1 120px", minWidth: 90 }}
          onCommit={(value) => set({ value })}
        />
        {c.operator === "between" && (
          <>
            <span className="fk-rw">and</span>
            <DraftPill
              aria-label="Upper number"
              aria-invalid={bad(c.value2)}
              inputMode="decimal"
              placeholder="e.g. 20"
              value={c.value2 ?? ""}
              wrapStyle={{ flex: "0 1 120px", minWidth: 90 }}
              onCommit={(value2) => set({ value2 })}
            />
          </>
        )}
        {remove}
      </div>
    );
  }

  const vc = valueControl(q);
  const ops = opsFor(q);
  const op = ops.some((o) => o.value === c.operator) ? c.operator : ops[0]!.value;
  const needsValue = !VALUELESS.has(op) && vc.kind !== "none";
  const numeric = vc.kind !== "none" && !!vc.numeric;
  const isNum = (x?: string) => /^-?\d+(\.\d+)?$/.test((x ?? "").trim());
  const bad = needsValue && numeric && (c.value ?? "").trim() !== "" && !isNum(c.value);
  const badPattern = (() => {
    if (op !== "matches" || !c.value) return false;
    try {
      new RegExp(c.value);
      return false;
    } catch {
      return true;
    }
  })();
  const date = q?.type === "date";
  const text = (key: "value" | "value2", label: string) => (
    <DraftPill
      aria-label={label}
      aria-invalid={key === "value" ? bad || badPattern : numeric && !!c.value2 && !isNum(c.value2)}
      inputMode={numeric ? "decimal" : "text"}
      placeholder={
        date
          ? "YYYY-MM-DD"
          : op === "email-domain"
            ? "company.com"
            : op === "matches"
              ? "e.g. ^[A-Z]{2}\\d{4}$"
              : vc.kind === "text"
                ? vc.placeholder
                : "Type a value"
      }
      value={(key === "value" ? c.value : c.value2) ?? ""}
      wrapStyle={{ flex: "0 1 170px", minWidth: 120 }}
      onCommit={(v) => set({ [key]: v })}
    />
  );

  return (
    <div>
      <div className="fk-rule-row">
        {chip}
        {sourcePick}
        <div style={{ flex: "1 1 200px", minWidth: 170 }}>
          <Select
            size="sm"
            ariaLabel="Which question"
            placeholder="Pick a question"
            value={(c.blockId as string | undefined) ?? null}
            options={questionOptions}
            onChange={(v) => {
              const nq = questions.find((x) => x._id === v);
              const nops = opsFor(nq).map((o) => o.value);
              set({
                blockId: v as Id<"blocks">,
                operator: nops.includes(c.operator) ? c.operator : nops[0]!,
                value: firstValue(nq),
                value2: undefined,
              });
            }}
          />
        </div>
        <div style={{ flex: "0 0 auto", width: 170 }}>
          <Select
            size="sm"
            ariaLabel="Comparison"
            value={op}
            options={ops}
            onChange={(v) =>
              set({ operator: v, ...(MULTI.has(v) !== MULTI.has(op) ? { value: MULTI.has(v) ? "" : firstValue(q) } : {}) })
            }
          />
        </div>
        {needsValue && vc.kind === "select" && !MULTI.has(op) && op !== "between" && (
          <div style={{ flex: "0 0 auto", width: 180 }}>
            <Select
              size="sm"
              ariaLabel="Which answer"
              placeholder="An answer"
              value={c.value ?? null}
              options={vc.options.map((o) => ({ value: o, label: o }))}
              onChange={(v) => set({ value: v })}
            />
          </div>
        )}
        {needsValue && (vc.kind === "text" || op === "between") && !MULTI.has(op) && text("value", "Which answer")}
        {needsValue && op === "between" && (
          <>
            <span className="fk-rw">and</span>
            {text("value2", "Upper end")}
          </>
        )}
        {!needsValue && (
          <span className="fk-proprow-hint" style={{ margin: 0, padding: "0 4px", fontSize: 13.5 }}>
            {VALUELESS.has(op) ? "no value needed" : vc.kind === "none" ? vc.note : "any value"}
          </span>
        )}
        {remove}
      </div>
      {needsValue && MULTI.has(op) && vc.kind === "select" && (
        <div className="fk-rule-row" style={{ paddingLeft: 54 }}>
          <OptionPicks
            options={vc.options}
            picked={(c.value ?? "").split("|").filter(Boolean)}
            onChange={(next) => set({ value: next.join("|") })}
          />
        </div>
      )}
      {(bad || badPattern || (needsValue && vc.kind === "text" && vc.note)) && (
        <p className="fk-rule-note" data-bad={bad || badPattern ? "true" : undefined}>
          {badPattern
            ? "That pattern isn’t valid, so it will never match."
            : bad
              ? `This needs a number. “${(c.value ?? "").trim()}” will never match. Type 18 and pick “is at least”.`
              : "Answers to this question are read as numbers, so “is at least” and “is at most” work here."}
        </p>
      )}
    </div>
  );
}

/**
 * Pro: other endings a rule can finish on - a different thank-you for
 * people who qualify and people who don't, or a page of their own.
 */
function Endings({ formId, form, rules }: { formId: Id<"forms">; form: Form; rules: Rule[] }) {
  const toast = useToast();
  const setEndings = useMutation(api.forms.setEndings);
  const gate = useGate("logic.advanced", form.ownerPlan?.features);
  const endings = form.endings ?? [];
  type Ending = (typeof endings)[number];

  const save = async (next: Ending[]) => {
    try {
      await tracked(setEndings({ formId, endings: next }));
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That ending did not save."));
    }
  };
  const edit = (i: number, p: Partial<Ending>) => save(endings.map((e, k) => (k === i ? { ...e, ...p } : e)));

  return (
    <section className="fk-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={{ flex: 1, margin: 0 }}>Endings</h3>
        {gate.locked && <ProChip onClick={() => openUpgrade({ feature: "logic.advanced" })} />}
      </div>
      <p className="fk-panel-lede">
        A different last screen for different people, say one for those who qualify and one for those who don’t.
        Finish on one with a rule’s “End with”. Everyone else sees the usual thank-you screen.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {endings.map((e, i) => {
          const used = rules.filter((r) => r.action === "ending" && r.endingId === e.id).length;
          return (
            <div key={e.id} className="fk-ending">
              <div className="fk-ending-head">
                <Flag size={15} strokeWidth={1.8} aria-hidden style={{ display: "inline-block", flex: "0 0 auto" }} />
                <DraftInput
                  className="fk-rule-name"
                  aria-label="Ending name"
                  placeholder="Name this ending"
                  value={e.name}
                  onCommit={(name) => edit(i, { name })}
                />
                <span className="fk-proprow-hint" style={{ margin: 0, fontSize: 13 }}>
                  {used ? `Used by ${used} rule${used === 1 ? "" : "s"}` : "No rule ends here yet"}
                </span>
                <IconButton label="Remove ending" onClick={() => save(endings.filter((_, k) => k !== i))}>
                  <Trash2 size={16} strokeWidth={1.8} aria-hidden />
                </IconButton>
              </div>
              <DraftPill
                aria-label="Heading"
                placeholder="Heading, e.g. You’re a great fit"
                value={e.title}
                size="md"
                wrapStyle={{ width: "100%" }}
                onCommit={(title) => edit(i, { title })}
              />
              <DraftArea
                aria-label="Message"
                rows={3}
                placeholder="What they read. Quote answers and results as {{key}}."
                value={e.message}
                onCommit={(message) => edit(i, { message })}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <DraftPill
                  aria-label="Button label"
                  placeholder="Button label (optional)"
                  value={e.buttonLabel ?? ""}
                  wrapStyle={{ flex: "1 1 160px" }}
                  onCommit={(buttonLabel) => edit(i, { buttonLabel })}
                />
                <DraftPill
                  aria-label="Button link"
                  placeholder="https://… (button link)"
                  value={e.buttonUrl ?? ""}
                  wrapStyle={{ flex: "2 1 220px" }}
                  onCommit={(buttonUrl) => edit(i, { buttonUrl })}
                />
              </div>
              <DraftPill
                aria-label="Send people to a page instead"
                placeholder="Or send them straight to a page: https://…"
                value={e.redirect ?? ""}
                wrapStyle={{ width: "100%" }}
                onCommit={(redirect) => edit(i, { redirect })}
              />
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14 }}>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />}
          onClick={gate.guard(() =>
            save([
              ...endings,
              {
                id: crypto.randomUUID().slice(0, 8),
                name: `Ending ${endings.length + 1}`,
                title: "Thanks, you’re all set",
                message: "",
              },
            ]),
          )}
        >
          Add an ending
        </Button>
      </div>
    </section>
  );
}

/**
 * Pro: named formulas over question keys - a quiz score, a quote, a total.
 * Worked out when a response is sent, kept with it, and quotable on the
 * thank-you screen as {{name}}.
 */
function Calculations({
  formId,
  form,
}: {
  formId: Id<"forms">;
  form: NonNullable<FunctionReturnType<typeof api.forms.get>>;
}) {
  const toast = useToast();
  const setCalc = useMutation(api.forms.setCalc);
  const gate = useGate("logic.calc", form.ownerPlan?.features);
  const calc = form.calc ?? [];
  const keyed = form.blocks.filter((b) => b.kind === "field" && b.key);

  const save = async (next: { name: string; formula: string }[]) => {
    try {
      await tracked(setCalc({ formId, calc: next }));
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That calculation did not save."));
    }
  };

  const known = (i: number) => new Set([...keyed.map((b) => b.key!), ...calc.slice(0, i).map((c) => c.name)]);

  return (
    <section className="fk-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={{ flex: 1, margin: 0 }}>Calculations</h3>
        {gate.locked && <ProChip onClick={() => openUpgrade({ feature: "logic.calc" })} />}
      </div>
      <p className="fk-panel-lede">
        Add up points, price a quote or score a quiz. Use question keys and earlier results, with + − × ÷, brackets,
        and min, max or round. Quote a result on the thank-you screen as {"{{total}}"}.
      </p>
      {keyed.length === 0 && (
        <p className="fk-proprow-hint" style={{ margin: "0 0 12px" }}>
          Give questions a key first. Select one in Build and fill in Key.
        </p>
      )}
      {keyed.length > 0 && (
        <p className="fk-proprow-hint" style={{ margin: "0 0 12px" }}>
          Keys on this form: {keyed.map((b) => b.key).join(", ")}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {calc.map((c, i) => {
          const missing = unknownKeys(c.formula, known(i));
          return (
            <div key={`${c.name}-${i}`} className="fk-calcrow">
              <DraftPill
                value={c.name}
                placeholder="total"
                wrapStyle={{ width: 150 }}
                onCommit={(name) => save(calc.map((x, k) => (k === i ? { ...x, name } : x)))}
              />
              <span className="fk-rw">=</span>
              <DraftPill
                value={c.formula}
                placeholder="quality + value * 2"
                wrapStyle={{ flex: 1, minWidth: 200 }}
                onCommit={(formula) => save(calc.map((x, k) => (k === i ? { ...x, formula } : x)))}
              />
              <IconButton label="Remove calculation" onClick={() => save(calc.filter((_, k) => k !== i))}>
                <Trash2 size={16} strokeWidth={1.8} aria-hidden />
              </IconButton>
              {missing.length > 0 && (
                <span className="fk-proprow-hint" style={{ flexBasis: "100%", color: "var(--red-600)" }}>
                  Not a key on this form: {missing.join(", ")}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 14 }}>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />}
          onClick={gate.guard(() => {
            const taken = new Set([...keyed.map((b) => b.key), ...calc.map((c) => c.name)]);
            let name = "total";
            for (let n = 2; taken.has(name); n++) name = `total_${n}`;
            void save([...calc, { name, formula: keyed.map((b) => b.key).join(" + ") || "0" }]);
          })}
        >
          Add a calculation
        </Button>
      </div>
    </section>
  );
}
