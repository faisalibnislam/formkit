"use client";

import { useMutation, useQuery } from "convex/react";
import { GitBranch, Plus, Trash2, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Button, IconButton, Segmented, Select, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { DraftInput, DraftPill } from "./Draft";
import { VALUELESS, firstValue, opLabel, opsFor, valueControl } from "./operators";
import { tracked } from "./saveStatus";

/**
 * Conditional logic. Show, hide or require a question — or jump ahead — based
 * on an earlier answer. Rules run top to bottom.
 *
 * A rule may test more than one answer; AND needs every condition to hold,
 * OR any one of them. The comparisons and the way a value is picked follow
 * the question being tested, so "18 or older" is "is at least 18" on a number
 * and a choice question offers its own options rather than a text box.
 *
 * Rules belong to their form: a rule written here never shows up on another
 * form's questions.
 */

type Rule = Doc<"logicRules">;
type Condition = Rule["conditions"][number];

const ACTIONS = [
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
  { value: "require", label: "Require" },
  { value: "jump", label: "Jump to" },
] as const;

export function LogicTab({ formId }: { formId: Id<"forms"> }) {
  const toast = useToast();
  const form = useQuery(api.forms.get, { formId });
  const rules = useQuery(api.logic.list, { formId });
  const add = useMutation(api.logic.add);
  const update = useMutation(api.logic.update);
  const remove = useMutation(api.logic.remove);

  if (!form) return null;

  const questions = form.blocks.filter((b) => b.kind === "field");
  const byId = (id?: Id<"blocks">) => questions.find((q) => q._id === id);
  const questionOptions = questions.map((q) => {
    const t = q.title || "Untitled question";
    return { value: q._id as string, label: t.length > 40 ? `${t.slice(0, 38)}…` : t };
  });

  const patch = (ruleId: Id<"logicRules">, p: Parameters<typeof update>[0]["patch"]) =>
    tracked(update({ ruleId, patch: p }));

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
            Show, hide or require a question based on an earlier answer. Rules run top to bottom.
          </p>
        </div>
        {addButton}
      </section>

      {questions.length < 2 && (
        <div className="fk-note">
          <span>
            Logic needs at least two questions — one to answer, one to affect. Add another under
            Build.
          </span>
        </div>
      )}

      {rules && rules.length === 0 && questions.length >= 2 && (
        <section className="fk-panel">
          <div className="fk-nothing" style={{ background: "transparent", padding: "34px 12px" }}>
            <span className="fk-nothing-mark">
              <GitBranch size={20} strokeWidth={1.8} aria-hidden />
            </span>
            <h3>No rules yet.</h3>
            <p style={{ maxWidth: "40ch" }}>
              Most forms do not need any. Add one when a question only matters to some people.
            </p>
            <div style={{ marginTop: 14 }}>{addButton}</div>
          </div>
        </section>
      )}

      {(rules ?? []).map((rule, i) => {
        const setConditions = (conditions: Condition[]) => patch(rule._id, { conditions });
        const target = byId(rule.targetId);
        return (
          <section key={rule._id} className="fk-panel fk-rule" data-off={rule.enabled ? undefined : "true"}>
            <div className="fk-rule-head">
              <span className="fk-rule-no">{String(i + 1).padStart(2, "0")}</span>
              <DraftInput
                className="fk-rule-name"
                aria-label="Rule name"
                title="Click to rename"
                placeholder="Name this rule"
                value={rule.name}
                onCommit={(name) => patch(rule._id, { name })}
              />
              <span className="fk-proprow-hint" style={{ margin: 0, fontSize: 13.5 }}>
                {rule.enabled ? "On" : "Off"}
              </span>
              <Switch
                checked={rule.enabled}
                label={`${rule.name || "This rule"} is on`}
                onChange={async (on) => {
                  await patch(rule._id, { enabled: on });
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

            {rule.conditions.map((c, k) => {
              const q = byId(c.blockId);
              const vc = valueControl(q);
              const ops = opsFor(q);
              const op = ops.some((o) => o.value === c.operator) ? c.operator : ops[0]!.value;
              const needsValue = !VALUELESS.has(op) && vc.kind !== "none";
              const numeric = vc.kind !== "none" && !!vc.numeric;
              const bad =
                needsValue &&
                numeric &&
                (c.value ?? "").trim() !== "" &&
                !/^-?\d+(\.\d+)?$/.test((c.value ?? "").trim());
              const setCondition = (next: Partial<Condition>) =>
                setConditions(rule.conditions.map((x, j) => (j === k ? { ...x, ...next } : x)));

              return (
                <div key={k}>
                  <div className="fk-rule-row">
                    <span className="fk-rule-chip">
                      {k === 0 ? "If" : rule.join === "or" ? "Or" : "And"}
                    </span>
                    <div style={{ flex: "1 1 220px", minWidth: 180 }}>
                      <Select
                        size="sm"
                        ariaLabel="Which question"
                        placeholder="Pick a question"
                        value={(c.blockId as string | undefined) ?? null}
                        options={questionOptions}
                        onChange={(v) => {
                          const nq = byId(v as Id<"blocks">);
                          const nops = opsFor(nq).map((o) => o.value);
                          setCondition({
                            blockId: v as Id<"blocks">,
                            operator: nops.includes(c.operator) ? c.operator : nops[0]!,
                            value: firstValue(nq),
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
                        onChange={(v) => setCondition({ operator: v })}
                      />
                    </div>
                    {needsValue && vc.kind === "select" && (
                      <div style={{ flex: "0 0 auto", width: 190 }}>
                        <Select
                          size="sm"
                          ariaLabel="Which answer"
                          placeholder="An answer"
                          value={c.value ?? null}
                          options={vc.options.map((o) => ({ value: o, label: o }))}
                          onChange={(v) => setCondition({ value: v })}
                        />
                      </div>
                    )}
                    {needsValue && vc.kind === "text" && (
                      <DraftPill
                        aria-label="Which answer"
                        aria-invalid={bad}
                        inputMode={numeric ? "decimal" : "text"}
                        placeholder={vc.placeholder}
                        value={c.value ?? ""}
                        wrapStyle={{ flex: "0 1 190px", minWidth: 150 }}
                        onCommit={(value) => setCondition({ value })}
                      />
                    )}
                    {!needsValue && (
                      <span className="fk-proprow-hint" style={{ margin: 0, padding: "0 4px", fontSize: 13.5 }}>
                        {VALUELESS.has(op) ? "no value needed" : vc.kind === "none" ? vc.note : "any value"}
                      </span>
                    )}
                    {rule.conditions.length > 1 && (
                      <IconButton
                        label="Remove this condition"
                        onClick={() => setConditions(rule.conditions.filter((_, j) => j !== k))}
                      >
                        <X size={15} strokeWidth={1.8} aria-hidden />
                      </IconButton>
                    )}
                  </div>
                  {(bad || (needsValue && vc.kind === "text" && vc.note)) && (
                    <p className="fk-rule-note" data-bad={bad ? "true" : undefined}>
                      {bad
                        ? `This needs a number — “${(c.value ?? "").trim()}” will never match. Type 18 and pick “is at least”.`
                        : "Answers to this question are read as numbers, so “is at least” and “is at most” work here."}
                    </p>
                  )}
                </div>
              );
            })}

            <Button
              variant="ghost"
              size="sm"
              style={{ margin: "0 0 12px 50px" }}
              iconLeft={<Plus size={15} strokeWidth={1.8} aria-hidden />}
              onClick={() => {
                const q = questions.find((x) => x._id !== rule.targetId) ?? questions[0];
                void setConditions([
                  ...rule.conditions,
                  { blockId: q?._id, operator: "is", value: firstValue(q) },
                ]);
              }}
            >
              Add condition
            </Button>

            <div className="fk-rule-row">
              <span className="fk-rule-chip" data-tone="sky">
                Then
              </span>
              <div style={{ flex: "0 0 auto", width: 150 }}>
                <Select
                  size="sm"
                  ariaLabel="What happens"
                  value={rule.action}
                  options={ACTIONS.map((a) => ({ value: a.value, label: a.label }))}
                  onChange={(v) => patch(rule._id, { action: v as Rule["action"] })}
                />
              </div>
              <div style={{ flex: "1 1 220px", minWidth: 180 }}>
                <Select
                  size="sm"
                  ariaLabel="Which question is affected"
                  placeholder="Pick a question"
                  value={(rule.targetId as string | undefined) ?? null}
                  options={questionOptions}
                  onChange={(v) => patch(rule._id, { targetId: v as Id<"blocks"> })}
                />
              </div>
            </div>

            <div className="fk-rulecard-sentence" style={{ marginTop: 18, background: "var(--neutral-50)" }}>
              {rule.conditions.map((c, k) => (
                <span key={k} style={{ display: "contents" }}>
                  <span className="fk-rw">{k === 0 ? "If" : rule.join === "or" ? "or" : "and"}</span>
                  <span className="fk-rchip">{byId(c.blockId)?.title || "—"}</span>
                  <span className="fk-rw">{opLabel(c.operator)}</span>
                  {!VALUELESS.has(c.operator) && valueControl(byId(c.blockId)).kind !== "none" && (
                    <span className="fk-rchip" data-tone="ink">
                      {c.value || "—"}
                    </span>
                  )}
                </span>
              ))}
              <span className="fk-rw">then</span>
              <span className="fk-rchip" data-tone="sky">
                {ACTIONS.find((a) => a.value === rule.action)?.label}
              </span>
              <span className="fk-rchip">{target?.title || "—"}</span>
            </div>

            {rule.conditions.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
                <Segmented
                  ariaLabel="How the conditions combine"
                  size="sm"
                  value={rule.join}
                  onChange={(join) => patch(rule._id, { join })}
                  options={[
                    { value: "and", label: "AND" },
                    { value: "or", label: "OR" },
                  ]}
                />
                <span className="fk-proprow-hint" style={{ margin: 0, fontSize: 13.5 }}>
                  {rule.join === "or"
                    ? "Any one of these conditions is enough"
                    : "Every one of these conditions has to hold"}
                </span>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
