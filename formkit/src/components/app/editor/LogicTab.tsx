"use client";

import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, EmptyState, IconButton, Input, Select, Switch } from "@/components/ui";
import { OPERATORS, VALUELESS, operatorGroup } from "./operators";

/**
 * Conditional logic. A rule reads as a sentence, and the first rule that
 * matches wins.
 *
 * Rules belong to their form: a rule written here never shows up on another
 * form's questions.
 */
export function LogicTab({ formId }: { formId: Id<"forms"> }) {
  const form = useQuery(api.forms.get, { formId });
  const rules = useQuery(api.logic.list, { formId });
  const add = useMutation(api.logic.add);
  const update = useMutation(api.logic.update);
  const remove = useMutation(api.logic.remove);

  if (!form) return null;

  const questions = form.blocks.filter((b) => b.kind === "field");
  const questionOptions = questions.map((q) => ({
    value: q._id as string,
    label: q.title ?? "Untitled question",
  }));

  return (
    <>
      <section className="fk-panel">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h3>Rules</h3>
            <p className="fk-panel-lede" style={{ marginBottom: 0 }}>
              When someone answers a certain way, skip ahead or show a question that was hidden.
              The first rule that matches is the one that runs.
            </p>
          </div>
          <Button
            iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />}
            disabled={questions.length < 2}
            onClick={() => add({ formId, action: "show" })}
          >
            Add a rule
          </Button>
        </div>

        {questions.length < 2 && (
          <div className="fk-note" style={{ marginTop: 16 }}>
            <span>
              Logic needs at least two questions — one to answer, one to affect. Add another under
              Build.
            </span>
          </div>
        )}
      </section>

      {rules && rules.length === 0 ? (
        <section className="fk-panel">
          <EmptyState
            title="No rules yet"
            description="Without a rule everyone sees every question, in order."
          />
        </section>
      ) : (
        (rules ?? []).map((rule) => {
          const condition = rule.conditions[0] ?? { operator: "is" };
          const trigger = questions.find((q) => q._id === condition.blockId);
          const group = operatorGroup(trigger?.type, trigger?.title);
          const operators = OPERATORS[group]!;
          const needsValue = !VALUELESS.has(condition.operator);

          return (
            <section key={rule._id} className="fk-panel">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Input
                  value={rule.name}
                  aria-label="Rule name"
                  onChange={(e) => update({ ruleId: rule._id, patch: { name: e.target.value } })}
                  style={{ maxWidth: 280 }}
                />
                <span className="fk-toolbar-spacer" />
                <span style={{ fontSize: 13.5, color: "var(--color-text-tertiary)" }}>
                  {rule.enabled ? "On" : "Paused"}
                </span>
                <Switch
                  checked={rule.enabled}
                  label={`${rule.name} is on`}
                  onChange={(on) => update({ ruleId: rule._id, patch: { enabled: on } })}
                />
                <IconButton
                  label={`Delete ${rule.name}`}
                  tone="danger"
                  onClick={() => remove({ ruleId: rule._id })}
                >
                  <Trash2 size={16} strokeWidth={1.8} aria-hidden />
                </IconButton>
              </div>

              <div className="fk-subrow">
                <div style={{ flex: 2, minWidth: 190 }}>
                  <div className="fk-sublabel">When</div>
                  <Select
                    value={(condition.blockId as string | undefined) ?? null}
                    ariaLabel="Which question"
                    placeholder="Pick a question"
                    options={questionOptions}
                    onChange={(v) =>
                      update({
                        ruleId: rule._id,
                        patch: {
                          conditions: [{ ...condition, blockId: v as Id<"blocks">, value: undefined }],
                        },
                      })
                    }
                  />
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div className="fk-sublabel">and it</div>
                  <Select
                    value={condition.operator}
                    ariaLabel="Comparison"
                    options={operators}
                    onChange={(v) =>
                      update({ ruleId: rule._id, patch: { conditions: [{ ...condition, operator: v }] } })
                    }
                  />
                </div>
                {needsValue && (
                  <div style={{ flex: 1.2, minWidth: 150 }}>
                    <div className="fk-sublabel">this</div>
                    {trigger?.options?.length ? (
                      <Select
                        value={condition.value ?? null}
                        ariaLabel="Which answer"
                        placeholder="An answer"
                        options={trigger.options.map((o) => ({ value: o, label: o }))}
                        onChange={(v) =>
                          update({ ruleId: rule._id, patch: { conditions: [{ ...condition, value: v }] } })
                        }
                      />
                    ) : (
                      <Input
                        inputSize="sm"
                        value={condition.value ?? ""}
                        aria-label="Which answer"
                        placeholder={group === "number" ? "18" : "An answer"}
                        onChange={(e) =>
                          update({
                            ruleId: rule._id,
                            patch: { conditions: [{ ...condition, value: e.target.value }] },
                          })
                        }
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="fk-subrow" style={{ marginTop: 10 }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div className="fk-sublabel">then</div>
                  <Select
                    value={rule.action}
                    ariaLabel="What happens"
                    options={[
                      { value: "show", label: "show", note: "Reveal a hidden question" },
                      { value: "hide", label: "hide", note: "Take a question away" },
                      { value: "require", label: "require", note: "Make an answer compulsory" },
                      { value: "jump", label: "jump to", note: "Skip ahead" },
                    ]}
                    onChange={(v) =>
                      update({
                        ruleId: rule._id,
                        patch: { action: v as "show" | "hide" | "require" | "jump" },
                      })
                    }
                  />
                </div>
                <div style={{ flex: 2, minWidth: 190 }}>
                  <div className="fk-sublabel">this question</div>
                  <Select
                    value={(rule.targetId as string | undefined) ?? null}
                    ariaLabel="Which question is affected"
                    placeholder="Pick a question"
                    options={questionOptions.filter((o) => o.value !== condition.blockId)}
                    onChange={(v) => update({ ruleId: rule._id, patch: { targetId: v as Id<"blocks"> } })}
                  />
                </div>
              </div>

              {group === "number" && trigger?.type === "short-text" && (
                <p style={{ margin: "12px 2px 0", fontSize: 13, color: "var(--color-text-tertiary)" }}>
                  This question is short text, but it reads as a number, so the comparisons here are
                  numeric.
                </p>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
