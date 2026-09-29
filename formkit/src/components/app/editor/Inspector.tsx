"use client";

import { conditionsOf } from "../../../../convex/model/logicEval";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useSeededQuery } from "@/lib/seed";
import {
  Asterisk,
  CornerDownRight,
  Eye,
  EyeOff,
  GitBranch,
  GripVertical,
  MousePointerClick,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, Field, IconButton, Input, Select, Switch } from "@/components/ui";
import { errorText } from "../settings/bits";
import { useToast } from "@/components/ui/Toast";
import { DraftArea, DraftPill } from "./Draft";
import {
  FIELD_TYPES,
  fieldType,
  hasOptions,
  hasPlaceholder,
  hasScale,
  parseAccept,
} from "./fieldTypes";
import { VALUELESS, firstValue, opLabel } from "./operators";
import { tracked } from "./saveStatus";
import { openUpgrade, upgradeOnPlanError, useGate, usePlan } from "@/components/plan/usePlan";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { suggestKey } from "../../../../convex/model/calc";

type Block = Doc<"blocks">;
type Rule = Doc<"logicRules">;

const ACTION_LABEL: Record<Rule["action"], string> = {
  show: "Show",
  hide: "Hide",
  require: "Require",
  jump: "Jump to",
  "hide-options": "Hide options on",
  ending: "End with",
};
const ACTION_VERB: Record<Rule["action"], string> = {
  show: "shows",
  hide: "hides",
  require: "requires",
  jump: "jumps to",
  "hide-options": "hides options on",
  ending: "ends with",
};
const ACTION_ICON: Record<Rule["action"], typeof Eye> = {
  show: Eye,
  hide: EyeOff,
  require: Asterisk,
  jump: CornerDownRight,
  "hide-options": EyeOff,
  ending: CornerDownRight,
};

function PropertyRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fk-proprow">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>{label}</div>
        {hint && <div className="fk-proprow-hint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function NothingSelected() {
  return (
    <section className="fk-panel" data-pad="tight">
      <div className="fk-nothing">
        <span className="fk-nothing-mark">
          <MousePointerClick size={20} strokeWidth={1.8} aria-hidden />
        </span>
        <h3>Nothing selected</h3>
        <p>Pick a question on the canvas to edit it here.</p>
      </div>
    </section>
  );
}

export function PageSettings({
  block,
  count,
  onDelete,
}: {
  block: Block;
  count: number;
  onDelete: () => void;
}) {
  const update = useMutation(api.blocks.update);
  return (
    <section className="fk-panel" data-pad="tight">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h3 style={{ flex: 1, margin: 0 }}>Page settings</h3>
        <Badge>Page break</Badge>
      </div>
      <Field label="Page name">
        <DraftPill
          value={block.pageName ?? ""}
          placeholder="Untitled page"
          onCommit={(pageName) => tracked(update({ blockId: block._id, patch: { pageName } }))}
        />
      </Field>
      <p className="fk-proprow-hint" style={{ margin: "12px 0 0" }}>
        {count === 0
          ? "No questions on this page yet. Add one below the break."
          : count === 1
            ? "One question on this page."
            : `${count} questions on this page.`}
      </p>
      <Button
        variant="ghost"
        size="sm"
        style={{ marginTop: 10, paddingLeft: 6 }}
        iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
        onClick={onDelete}
      >
        Delete page
      </Button>
    </section>
  );
}

export function FieldSettings({
  block,
  fields,
  rules,
}: {
  block: Block;
  /** Every question on the form, for naming the rules. */
  fields: Block[];
  rules: Rule[];
}) {
  const plan = usePlan();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const update = useMutation(api.blocks.update);
  const addRule = useMutation(api.logic.add);
  const updateRule = useMutation(api.logic.update);
  const unapply = useMutation(api.logic.unapply);

  const patch = (p: Parameters<typeof update>[0]["patch"]) =>
    tracked(update({ blockId: block._id, patch: p }));

  const meta = fieldType(block.type);
  const calcGate = useGate("logic.calc");
  const pipingGate = useGate("logic.piping");
  const hiddenGate = useGate("logic.hidden");
  const placesGate = useGate("logic.advanced");
  // A key is useful with any of the three; it is locked only when all are.
  const keyLocked = pipingGate.locked && hiddenGate.locked && calcGate.locked;
  const title = (id?: Id<"blocks">) =>
    fields.find((f) => f._id === id)?.title || (id ? "Untitled question" : "…");

  const mine = rules.filter(
    (r) => r.targetId === block._id || conditionsOf(r).some((c) => c.blockId === block._id),
  );
  const others = rules.filter((r) => !mine.includes(r));

  const note = (() => {
    if (!mine.length) {
      if (!rules.length)
        return "No rules on this form yet. Add one here and finish the condition on the Logic page.";
      return `${
        rules.length === 1
          ? "The one rule on this form does not touch this question."
          : `None of this form's ${rules.length} rules touch this question.`
      } Apply one below, or manage them all on the Logic page.`;
    }
    return mine.length === 1
      ? "One rule from the Logic page involves this question. Use the trash button to unapply it. The rule itself stays on the Logic page."
      : `${mine.length} rules from the Logic page involve this question. Use the trash button to unapply one. The rule itself stays on the Logic page.`;
  })();

  const gotoLogic = () => router.push(`${pathname}?tab=logic`);

  const options = block.options ?? [];
  const [optDrag, setOptDrag] = useState<number | null>(null);
  // Places per option, by position: 0 is no limit. They move with their option.
  const limits = options.map((_, i) => block.limits?.[i] ?? 0);
  const [placesOn, setPlacesOn] = useState(() => limits.some((n) => n > 0));
  const withLimits = (list: number[]) => (placesOn || list.some((n) => n > 0) ? { limits: list } : {});
  const moveOption = (from: number, to: number) => {
    if (from === to) return;
    const next = options.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    const lim = limits.slice();
    const [m] = lim.splice(from, 1);
    lim.splice(to, 0, m ?? 0);
    void patch({ options: next, ...withLimits(lim) });
  };
  const setPlaces = async (i: number, n: number) => {
    try {
      await tracked(update({ blockId: block._id, patch: { limits: limits.map((x, k) => (k === i ? n : x)) } }));
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That limit did not save."));
    }
  };

  return (
    <section className="fk-panel" data-pad="tight">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h3 style={{ flex: 1, margin: 0 }}>Field settings</h3>
        <Badge>{meta.label}</Badge>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 6 }}>
        <Field label="Question">
          <DraftPill
            value={block.title ?? ""}
            placeholder="Untitled question"
            onCommit={(t) => patch({ title: t })}
          />
        </Field>
        <Field label="Description">
          <DraftArea rows={2} value={block.help ?? ""} onCommit={(help) => patch({ help })} />
        </Field>
        <Field label="Field type">
          <Select
            value={block.type ?? "short-text"}
            ariaLabel="Field type"
            onChange={(next) =>
              patch({
                type: next as Block["type"],
                ...(hasOptions(next) && !block.options?.length
                  ? { options: fieldType(next).defaultOptions }
                  : {}),
                ...(next === "scale" && block.scaleMin === undefined
                  ? { scaleMin: 1, scaleMax: 5 }
                  : {}),
              })
            }
            options={FIELD_TYPES.map((t) => ({ value: t.type, label: t.label }))}
          />
        </Field>
      </div>

      {block.type !== "hidden" && (
        <PropertyRow label="Required" hint="People can't submit without it">
          <Switch
            checked={!!block.required}
            label="Required"
            onChange={(on) => patch({ required: on })}
          />
        </PropertyRow>
      )}

      <div className="fk-proprow" data-stack="true">
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 7 }}>
          Key
          {keyLocked && <ProChip onClick={() => openUpgrade({ feature: "logic.piping" })} />}
        </div>
        <DraftPill
          value={block.key ?? ""}
          placeholder={suggestKey(block.title)}
          onCommit={(key) =>
            void update({ blockId: block._id, patch: { key } }).catch((e) => toast(errorText(e, "That key did not save.")))
          }
        />
        <div className="fk-proprow-hint" style={{ marginTop: 6 }}>
          {block.key
            ? `Pre-fill it with ?${block.key}=… on the link, quote it later with {{${block.key}}}, and use it in calculations.`
            : "A short name, like budget. Pre-fills it from the link, quotes it in later text, and feeds calculations."}
        </div>
      </div>

      {block.type === "hidden" && (
        <div className="fk-proprow" data-stack="true">
          <div style={{ fontSize: 14, marginBottom: 7 }}>Default value</div>
          <DraftPill
            value={block.defaultValue ?? ""}
            placeholder="Used when the link does not carry one"
            onCommit={(defaultValue) => patch({ defaultValue })}
          />
        </div>
      )}

      {block.type === "hidden" && <FillWithAi block={block} fields={fields} />}

      {(hasOptions(block.type) || block.type === "yes-no") && (
        <div className="fk-proprow" data-stack="true">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 7 }}>
            Points
            {calcGate.locked && <ProChip onClick={() => openUpgrade({ feature: "logic.calc" })} />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(block.type === "yes-no" ? ["Yes", "No"] : options).map((o, i) => (
              <label key={`${o}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o}</span>
                <Input
                  type="number"
                  aria-label={`Points for ${o}`}
                  disabled={calcGate.locked}
                  defaultValue={block.scores?.[i] ?? 0}
                  wrapStyle={{ width: 90 }}
                  onBlur={(e) => {
                    const n = Number(e.target.value) || 0;
                    const count = block.type === "yes-no" ? 2 : options.length;
                    const next = Array.from({ length: count }, (_, k) => block.scores?.[k] ?? 0);
                    if (next[i] === n) return;
                    next[i] = n;
                    void update({ blockId: block._id, patch: { scores: next } }).catch((err) => {
                      if (!upgradeOnPlanError(err)) toast(errorText(err, "Those points did not save."));
                    });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="fk-proprow-hint" style={{ marginTop: 6 }}>
            For quizzes, scores and quotes. Add them up under Logic → Calculations.
          </div>
        </div>
      )}

      {hasPlaceholder(block.type) && (
        <div className="fk-proprow" data-stack="true">
          <div style={{ fontSize: 14, marginBottom: 7 }}>Placeholder</div>
          <DraftPill
            value={block.placeholder ?? ""}
            placeholder="Type your answer…"
            onCommit={(placeholder) => patch({ placeholder })}
          />
        </div>
      )}

      {block.type === "file" && (
        <>
          <PropertyRow
            label="Maximum size"
            hint={plan?.id === "business" ? "Set by your plan" : "Set by your plan. Larger on Pro and Business"}
          >
            <span className="fk-static-pill">{plan?.limits.uploadMb ?? 10} MB</span>
          </PropertyRow>
          <div className="fk-proprow" data-stack="true">
            <div style={{ fontSize: 14, marginBottom: 7 }}>Accepted files</div>
            <DraftPill
              value={(block.accept ?? []).join(" ")}
              placeholder="Any file"
              aria-label="Accepted files"
              onCommit={(text) => patch({ accept: parseAccept(text) })}
            />
            <div className="fk-proprow-hint" style={{ marginTop: 8 }}>
              Leave blank to accept anything. Otherwise list extensions, like .pdf .png .docx
            </div>
          </div>
        </>
      )}

      {hasScale(block.type) && (
        <div style={{ display: "flex", gap: 10, padding: "12px 0" }}>
          {block.type === "scale" && (
            <Field label="From">
              <DraftPill
                type="number"
                value={String(block.scaleMin ?? 1)}
                onCommit={(v) => patch({ scaleMin: Number(v) || 0 })}
              />
            </Field>
          )}
          <Field label={block.type === "rating" ? "Stars" : "To"}>
            <DraftPill
              type="number"
              value={String(block.scaleMax ?? 5)}
              onCommit={(v) => patch({ scaleMax: Math.max(2, Math.min(10, Number(v) || 5)) })}
            />
          </Field>
        </div>
      )}

      {hasOptions(block.type) && (
        <div style={{ padding: "14px 0 6px" }}>
          <div style={{ fontSize: 14, marginBottom: 10 }}>Options</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {options.map((o, i) => (
              <div
                key={i}
                className="fk-option-row"
                data-dragging={optDrag === i ? "true" : undefined}
                onDragOver={(e) => {
                  if (optDrag === null) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (optDrag !== null) moveOption(optDrag, i);
                  setOptDrag(null);
                }}
              >
                <span
                  className="fk-option-grip"
                  title="Drag to reorder"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(i));
                    e.dataTransfer.effectAllowed = "move";
                    setOptDrag(i);
                  }}
                  onDragEnd={() => setOptDrag(null)}
                >
                  <GripVertical size={14} strokeWidth={1.8} aria-hidden />
                </span>
                <DraftPill
                  value={o}
                  aria-label={`Option ${i + 1}`}
                  wrapStyle={{ flex: 1 }}
                  onCommit={(next) => {
                    const list = options.slice();
                    list[i] = next;
                    void patch({ options: list });
                  }}
                />
                {placesOn && (
                  <DraftPill
                    value={limits[i] ? String(limits[i]) : ""}
                    aria-label={`Places for ${o || `option ${i + 1}`}`}
                    title="Places. Leave empty for no limit"
                    placeholder="∞"
                    inputMode="numeric"
                    wrapStyle={{ flex: "0 0 64px", width: 64 }}
                    onCommit={(v) => void setPlaces(i, Math.max(0, Math.min(100000, Math.floor(Number(v) || 0))))}
                  />
                )}
                <IconButton
                  label={`Remove ${o || "this option"}`}
                  disabled={options.length <= 1}
                  onClick={() =>
                    patch({ options: options.filter((_, k) => k !== i), ...withLimits(limits.filter((_, k) => k !== i)) })
                  }
                >
                  <X size={15} strokeWidth={1.8} aria-hidden />
                </IconButton>
              </div>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            style={{ marginTop: 8, paddingLeft: 6 }}
            iconLeft={<Plus size={15} strokeWidth={1.8} aria-hidden />}
            onClick={() =>
              patch({ options: [...options, `Option ${options.length + 1}`], ...withLimits([...limits, 0]) })
            }
          >
            Add option
          </Button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <span style={{ flex: 1, fontSize: 13.5 }}>
              Limit places
              <span className="fk-proprow-hint" style={{ display: "block", margin: "2px 0 0", fontSize: 12.5 }}>
                {placesOn
                  ? "Type how many people can pick each option. A full option can’t be picked."
                  : "For workshop seats, time slots or tickets."}
              </span>
            </span>
            {placesGate.locked && <ProChip onClick={() => openUpgrade({ feature: "logic.advanced" })} />}
            <Switch
              checked={placesOn}
              label="Limit places"
              onChange={placesGate.guard((on: boolean) => {
                setPlacesOn(on);
                if (!on && limits.some((n) => n > 0)) void patch({ limits: [] });
              })}
            />
          </div>
        </div>
      )}

      {block.type !== "hidden" && <QuizKey block={block} />}

      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <GitBranch size={16} strokeWidth={1.8} aria-hidden />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Conditional logic</span>
        </div>
        <p className="fk-proprow-hint" style={{ margin: "0 0 10px" }}>
          {note}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mine.map((r) => {
            const c = conditionsOf(r)[0]!;
            const extra = conditionsOf(r).length - 1;
            return (
              <div
                key={r._id}
                className="fk-rulecard"
                style={{ opacity: r.enabled ? 1 : 0.6 }}
              >
                <div className="fk-rulecard-name">{r.name || "Untitled rule"}</div>
                <div className="fk-rulecard-sentence">
                  <span className="fk-rw">If</span>
                  <span className="fk-rchip">{title(c?.blockId as Id<"blocks"> | undefined)}</span>
                  <span className="fk-rw">{opLabel(c?.operator)}</span>
                  {!VALUELESS.has(c?.operator ?? "") && (
                    <span className="fk-rchip" data-tone="ink">
                      {c?.value || "…"}
                    </span>
                  )}
                  {extra > 0 && (
                    <span className="fk-rw">
                      {r.join} {extra} more
                    </span>
                  )}
                  <span className="fk-rw">then</span>
                  <span className="fk-rchip" data-tone="sky">
                    {ACTION_LABEL[r.action]}
                  </span>
                  <span className="fk-rchip">{title(r.targetId)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="fk-proprow-hint" style={{ flex: 1 }}>
                    {r.targetId === block._id
                      ? "This question is affected"
                      : "This question triggers it"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Pencil size={14} strokeWidth={1.8} aria-hidden />}
                    onClick={gotoLogic}
                  >
                    Edit
                  </Button>
                  <IconButton
                    label={`Unapply ${r.name || "this rule"} from this question`}
                    onClick={async () => {
                      const said = await tracked(unapply({ ruleId: r._id, blockId: block._id }));
                      toast("Rule unapplied", { detail: said });
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>

        {others.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="fk-proprow-hint" style={{ marginBottom: 8 }}>
              Apply another rule from the Logic page to this question:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {others.map((r) => {
                const Icon = ACTION_ICON[r.action];
                return (
                  <Button
                    key={r._id}
                    variant="secondary"
                    size="sm"
                    style={{ width: "100%", justifyContent: "flex-start" }}
                    iconLeft={<Icon size={14} strokeWidth={1.8} aria-hidden />}
                    onClick={async () => {
                      await tracked(
                        updateRule({ ruleId: r._id, patch: { targetId: block._id, enabled: true } }),
                      );
                      toast("Rule applied", {
                        detail: `${r.name || "That rule"} now ${ACTION_VERB[r.action]} this question`,
                      });
                    }}
                  >
                    {r.name || "Untitled rule"}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <Button
            variant="ghost"
            size="sm"
            style={{ marginTop: 10, paddingLeft: 6 }}
            iconLeft={<Plus size={15} strokeWidth={1.8} aria-hidden />}
            onClick={async () => {
              const trigger = fields.find((f) => f._id !== block._id) ?? fields[0];
              await tracked(
                addRule({
                  formId: block.formId,
                  action: "show",
                  targetId: block._id,
                  conditions: [
                    { blockId: trigger?._id, operator: "is", value: firstValue(trigger) },
                  ],
                }),
              );
              toast("Rule added", { detail: "Name it and finish the condition here" });
              gotoLogic();
            }}
          >
            New rule
          </Button>
          <Button
            variant="ghost"
            size="sm"
            style={{ marginTop: 4, paddingLeft: 6 }}
            iconLeft={<GitBranch size={15} strokeWidth={1.8} aria-hidden />}
            onClick={gotoLogic}
          >
            Open Logic
          </Button>
        </div>
      </div>
    </section>
  );
}

/**
 * Business: a hidden field the AI fills with a fact pulled out of an earlier
 * answer - a budget from a paragraph, a company name from an email.
 */
function FillWithAi({ block, fields }: { block: Block; fields: Block[] }) {
  const toast = useToast();
  const update = useMutation(api.blocks.update);
  const gate = useGate("logic.ai");
  const [on, setOn] = useState(!!block.extract);
  const sources = fields.filter(
    (f) => f._id !== block._id && f.type && !["hidden", "file", "signature"].includes(f.type) && f.order < block.order,
  );
  const save = async (extract: { from: Id<"blocks">; what: string } | null) => {
    try {
      await tracked(update({ blockId: block._id, patch: { extract } }));
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not save."));
    }
  };
  const from = block.extract?.from ?? sources[sources.length - 1]?._id;

  return (
    <div className="fk-proprow" data-stack="true">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, fontSize: 14 }}>
          Fill it in with AI
          <span className="fk-proprow-hint" style={{ display: "block", margin: "2px 0 0", fontSize: 12.5 }}>
            Pulls one fact out of an earlier answer when that page is finished.
          </span>
        </span>
        {gate.locked && <ProChip plan="pro" onClick={() => openUpgrade({ feature: "logic.ai" })} />}
        <Switch
          checked={on}
          label="Fill it in with AI"
          onChange={gate.guard((next: boolean) => {
            setOn(next);
            if (!next && block.extract) void save(null);
          })}
        />
      </div>
      {on && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {sources.length === 0 ? (
            <span className="fk-proprow-hint" style={{ margin: 0 }}>
              Move this below the question it should read.
            </span>
          ) : (
            <>
              <Select
                size="sm"
                ariaLabel="Which answer to read"
                value={(from as string | undefined) ?? null}
                options={sources.map((f) => ({ value: f._id as string, label: f.title || "Untitled question" }))}
                onChange={(v) => void save({ from: v as Id<"blocks">, what: block.extract?.what ?? "" })}
              />
              <DraftPill
                aria-label="What to pull out"
                placeholder="e.g. their budget in pounds, as a number"
                value={block.extract?.what ?? ""}
                onCommit={(what) => from && void save({ from, what })}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Business, on a quiz: the right answer to this question and what it is
 * worth. Questions without a key - a written answer - are marked by hand.
 */
function QuizKey({ block }: { block: Block }) {
  const toast = useToast();
  const form = useSeededQuery(api.forms.get, { formId: block.formId });
  const update = useMutation(api.blocks.update);
  if (!form?.quiz?.enabled) return null;

  const save = async (patch: { answerKey?: string[]; marks?: number }) => {
    try {
      await tracked(update({ blockId: block._id, patch }));
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not save."));
    }
  };
  const key = block.answerKey ?? [];
  const options = block.type === "yes-no" ? ["Yes", "No"] : (block.options ?? []);
  const choice = ["single-choice", "dropdown", "yes-no", "multi-choice"].includes(block.type ?? "");
  const typed = ["short-text", "number", "email", "phone", "date", "name", "company"].includes(block.type ?? "");

  return (
    <div className="fk-proprow" data-stack="true" style={{ marginTop: 6 }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>Quiz</div>
      {choice ? (
        <>
          <div className="fk-proprow-hint" style={{ margin: "0 0 8px" }}>
            {block.type === "multi-choice" ? "Pick every right option. Only an answer with all of them, and nothing else, scores." : "Pick the right answer."}
          </div>
          <span className="fk-optpicks">
            {options.map((o) => {
              const on = key.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  className="fk-optpick"
                  aria-pressed={on}
                  onClick={() =>
                    void save({
                      answerKey:
                        block.type === "multi-choice" ? (on ? key.filter((k) => k !== o) : [...key, o]) : on ? [] : [o],
                    })
                  }
                >
                  {o}
                </button>
              );
            })}
          </span>
        </>
      ) : typed ? (
        <DraftPill
          value={key.join(" | ")}
          placeholder="Accepted answers, separated by |"
          onCommit={(v) => void save({ answerKey: v.split("|").map((x) => x.trim()).filter(Boolean) })}
        />
      ) : (
        <div className="fk-proprow-hint" style={{ margin: 0 }}>
          Marked by hand: open a response under Responses to give it marks.
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <span style={{ flex: 1, fontSize: 13.5 }}>Marks</span>
        <DraftPill
          value={block.marks !== undefined ? String(block.marks) : key.length ? "1" : ""}
          placeholder={choice || typed ? "1" : "0, not marked"}
          inputMode="decimal"
          wrapStyle={{ width: 110 }}
          onCommit={(v) => void save({ marks: v.trim() === "" ? (choice || typed ? 1 : 0) : Math.max(0, Number(v) || 0) })}
        />
      </div>
    </div>
  );
}
