"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Copy,
  GitBranch,
  GripVertical,
  Plus,
  Rows3,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import {
  Button,
  Checkbox,
  Field,
  IconButton,
  Input,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { FIELD_GROUPS, FIELD_TYPES, fieldType, hasOptions, hasScale } from "./fieldTypes";
import { FieldIcon } from "./FieldIcon";
import { QuestionPreview } from "./QuestionPreview";

/**
 * The builder: field library, canvas, inspector.
 *
 * Questions and page breaks are one ordered list, because that is what the
 * canvas shows. Reordering sends the whole new order in one mutation rather
 * than a pair of swaps, so a dropped card never lands twice.
 *
 * Dragging, of which there are two kinds: a field type dragged in from the
 * library, and a block dragged to a new place. Both land on an insert point
 * between two blocks rather than on a block, so where the thing will end up is
 * shown rather than inferred.
 *
 * A card is ALWAYS `draggable`, and `onCardPointerDown` decides whether the
 * press that began may start a drag. Do not go back to setting `draggable`
 * from state on mousedown — the browser reads the attribute before that state
 * lands, and the drag never starts. Every drag also writes something into
 * `dataTransfer`, because Firefox refuses to begin one that carries nothing.
 */

/* A press that lands on one of these is that control's, not the card's:
   without this, selecting the text in a page name starts a drag instead. */
const CONTROLS = "input, textarea, select, button, a, [contenteditable], [role='button']";

/** What a drag is carrying. */
type Payload = { kind: "block"; id: string } | { kind: "new"; type: string };

export function Builder({ formId }: { formId: Id<"forms"> }) {
  const toast = useToast();
  const form = useQuery(api.forms.get, { formId });
  const rules = useQuery(api.logic.list, { formId });

  const addBlock = useMutation(api.blocks.add);
  const updateBlock = useMutation(api.blocks.update);
  const removeBlock = useMutation(api.blocks.remove);
  const duplicateBlock = useMutation(api.blocks.duplicate);
  const reorder = useMutation(api.blocks.reorder);
  const updateForm = useMutation(api.forms.update);
  const unapply = useMutation(api.logic.unapply);

  const [libTerm, setLibTerm] = useState("");
  const [selected, setSelected] = useState<Id<"blocks"> | null>(null);

  const blocks = useMemo(() => form?.blocks ?? [], [form]);
  const active = blocks.find((b) => b._id === selected) ?? null;

  const library = FIELD_TYPES.filter((t) =>
    libTerm ? t.label.toLowerCase().includes(libTerm.trim().toLowerCase()) : true,
  );

  /* What is in flight: a block being moved, or a field type from the library.
     A ref, because the drop handler runs from a browser event and cannot wait
     for a render to commit. */
  const payload = useRef<Payload | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);

  /* Armed by a press that may start a drag, and read synchronously inside
     onDragStart — state would not have landed by the time the browser asks. */
  const gripArm = useRef(false);

  function onCardPointerDown(e: PointerEvent<HTMLElement>) {
    gripArm.current = !(e.target as HTMLElement).closest(CONTROLS);
  }

  function onCardDragStart(e: DragEvent<HTMLElement>, id: string) {
    if (!gripArm.current) {
      e.preventDefault();
      return;
    }
    payload.current = { kind: "block", id };
    // Firefox refuses to begin a drag that carries no data at all.
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDragging(id);
  }

  function onTileDragStart(e: DragEvent<HTMLElement>, type: string) {
    payload.current = { kind: "new", type };
    e.dataTransfer.setData("text/plain", type);
    e.dataTransfer.effectAllowed = "copy";
    setDragging("new");
  }

  function onDragFinished() {
    payload.current = null;
    gripArm.current = false;
    setDragging(null);
    setOverSlot(null);
  }

  async function add(type: string, at?: number) {
    const meta = FIELD_TYPES.find((t) => t.type === type)!;
    const index =
      at ?? (selected ? blocks.findIndex((b) => b._id === selected) + 1 : undefined);
    const id = await addBlock({
      formId,
      kind: "field",
      at: index,
      type: type as Doc<"blocks">["type"],
      title: `${meta.label} question`,
      options: meta.defaultOptions,
      ...(meta.preview === "scale" ? { scaleMin: 1, scaleMax: 5 } : {}),
      ...(meta.preview === "rating" ? { scaleMax: 5 } : {}),
    });
    setSelected(id);
  }

  /* Every drop lands on a slot between two blocks, never on a block itself:
     the insert point that opens under the pointer is the thing being aimed at,
     so where the block will land is never a guess. */
  async function dropAtSlot(slot: number) {
    const inFlight = payload.current;
    onDragFinished();
    if (!inFlight) return;

    if (inFlight.kind === "new") {
      await add(inFlight.type, slot);
      return;
    }

    const order = blocks.map((b) => b._id as string);
    const from = order.indexOf(inFlight.id);
    if (from < 0) return;
    const rest = order.filter((id) => id !== inFlight.id);
    // Removing the block first shifts every slot after it left by one.
    const to = from < slot ? slot - 1 : slot;
    if (to === from) return;
    rest.splice(to, 0, inFlight.id);
    await reorder({ formId, ids: rest as Id<"blocks">[] });
  }

  if (!form) return null;

  const pages = (() => {
    const out: { name: string; count: number }[] = [{ name: "First page", count: 0 }];
    for (const b of blocks) {
      if (b.kind === "pagebreak") out.push({ name: b.pageName ?? "Page", count: 0 });
      else out[out.length - 1]!.count += 1;
    }
    return out;
  })();

  /* Questions are numbered; page breaks are not, so a number always names the
     question a respondent would count. */
  const numbers = new Map<string, number>();
  let counted = 0;
  for (const b of blocks) if (b.kind !== "pagebreak") numbers.set(b._id, ++counted);

  /* A plain function rather than a component: it holds no state of its own, and
     a component declared here would remount on every render. */
  const renderSlot = (index: number) => (
    <div
      key={`slot-${index}`}
      className="fk-insert"
      data-armed={dragging ? "true" : undefined}
      data-on={overSlot === index ? "true" : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = payload.current?.kind === "new" ? "copy" : "move";
        setOverSlot(index);
      }}
      onDragLeave={() => setOverSlot((v) => (v === index ? null : v))}
      onDrop={(e) => {
        e.preventDefault();
        void dropAtSlot(index);
      }}
    >
      <span className="fk-insert-rule" />
      <button
        type="button"
        className="fk-insert-pill"
        onClick={() => add("short-text", index)}
      >
        <Plus size={15} strokeWidth={2.2} aria-hidden />
        Add field
      </button>
      <span className="fk-insert-rule" />
    </div>
  );

  const appliedRules = (rules ?? []).filter(
    (r) => r.targetId === selected || r.conditions.some((c) => c.blockId === selected),
  );

  return (
    <div className="fk-build">
      {/* ---------- library ---------- */}
      <aside className="fk-panel" data-pad="tight">
        <Input
          inputSize="sm"
          value={libTerm}
          onChange={(e) => setLibTerm(e.target.value)}
          placeholder="Search fields"
          aria-label="Search field types"
          icon={<Search size={16} strokeWidth={1.8} aria-hidden />}
        />
        <p className="fk-library-lede">Drag one onto the form, or click to add it.</p>

        <div className="fk-library">
          {FIELD_GROUPS.map((group) => {
            const items = library.filter((t) => t.group === group);
            if (!items.length) return null;
            return (
              <div key={group}>
                <div className="fk-library-group">{group}</div>
                {items.map((t) => (
                  <button
                    key={t.type}
                    type="button"
                    className="fk-fieldtile"
                    draggable
                    onDragStart={(e) => onTileDragStart(e, t.type)}
                    onDragEnd={onDragFinished}
                    onClick={() => add(t.type)}
                  >
                    <span className="fk-fieldtile-mark">
                      <FieldIcon name={t.icon} />
                    </span>
                    <span className="fk-fieldtile-label">{t.label}</span>
                    <span className="fk-fieldtile-grip" aria-hidden>
                      <GripVertical size={15} strokeWidth={1.8} />
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
          {library.length === 0 && (
            <p className="fk-library-lede">Nothing matches “{libTerm}”.</p>
          )}
        </div>
      </aside>

      {/* ---------- canvas ---------- */}
      <div className="fk-canvas">
        <section className="fk-panel fk-screen">
          <div className="fk-screen-label">Welcome screen · what people see first</div>
          <Input
            value={form.welcome?.title ?? ""}
            aria-label="Welcome title"
            placeholder="Give this form a title"
            onChange={(e) =>
              updateForm({
                formId,
                patch: {
                  welcome: { ...(form.welcome ?? { message: "" }), title: e.target.value },
                },
              })
            }
          />
          <div style={{ marginTop: 10 }}>
            <Textarea
              rows={2}
              value={form.welcome?.message ?? ""}
              aria-label="Welcome message"
              placeholder="Add a line about what this form is for"
              onChange={(e) =>
                updateForm({
                  formId,
                  patch: {
                    welcome: { ...(form.welcome ?? { title: "" }), message: e.target.value },
                  },
                })
              }
            />
          </div>
        </section>

        {blocks.map((b, i) => (
          <Fragment key={b._id}>
            {renderSlot(i)}
            {b.kind === "pagebreak" ? (
              <div
                className="fk-pagebreak"
                data-dragging={b._id === dragging ? "true" : undefined}
                draggable
                onPointerDown={onCardPointerDown}
                onDragStart={(e) => onCardDragStart(e, b._id)}
                onDragEnd={onDragFinished}
              >
                <span
                  className="fk-pagebreak-grip"
                  aria-hidden
                  title="Drag to reorder"
                  onMouseEnter={() => {
                    gripArm.current = true;
                  }}
                >
                  <GripVertical size={15} strokeWidth={1.8} />
                </span>
                <Rows3 size={15} strokeWidth={1.8} aria-hidden />
                <input
                  className="fk-pagebreak-name"
                  value={b.pageName ?? ""}
                  aria-label="Page name"
                  onChange={(e) =>
                    updateBlock({ blockId: b._id, patch: { pageName: e.target.value } })
                  }
                />
                <span className="fk-pagebreak-rule" />
                <span>Page break</span>
                <IconButton
                  label="Delete this page break"
                  onClick={() => removeBlock({ blockId: b._id })}
                >
                  <Trash2 size={15} strokeWidth={1.8} aria-hidden />
                </IconButton>
              </div>
            ) : (
              <article
                className="fk-qcard"
                data-selected={b._id === selected ? "true" : undefined}
                data-dragging={b._id === dragging ? "true" : undefined}
                onClick={() => setSelected(b._id)}
                draggable
                onPointerDown={onCardPointerDown}
                onDragStart={(e) => onCardDragStart(e, b._id)}
                onDragEnd={onDragFinished}
              >
                <span className="fk-qcard-rail">
                  {/* The grip arms on hover too, so a press that starts there is
                      a drag even when it lands on something the guard refuses. */}
                  <span
                    className="fk-qcard-grip"
                    aria-hidden
                    title="Drag to reorder"
                    onMouseEnter={() => {
                      gripArm.current = true;
                    }}
                  >
                    <GripVertical size={17} strokeWidth={1.8} />
                  </span>
                  <span className="fk-qcard-index">
                    {String(numbers.get(b._id) ?? 0).padStart(2, "0")}
                  </span>
                </span>

                <div className="fk-qcard-body">
                  <div className="fk-qcard-type">
                    <FieldIcon name={fieldType(b.type).icon} size={14} />
                    <span>{fieldType(b.type).label}</span>
                    {(rules ?? []).some(
                      (r) =>
                        r.targetId === b._id || r.conditions.some((c) => c.blockId === b._id),
                    ) && (
                      <span className="fk-qcard-logic">
                        <GitBranch size={12} strokeWidth={1.9} aria-hidden />
                        Logic
                      </span>
                    )}
                  </div>
                  <h4 className="fk-qcard-title">
                    {b.title || "Untitled question"}
                    {b.required && (
                      <span className="fk-qcard-required" title="Required">
                        *
                      </span>
                    )}
                  </h4>
                  {b.help && <p className="fk-qcard-help">{b.help}</p>}
                  <div className="fk-qcard-preview">
                    <QuestionPreview
                      type={b.type ?? null}
                      options={b.options}
                      scaleMin={b.scaleMin}
                      scaleMax={b.scaleMax}
                    />
                  </div>
                </div>

                <div className="fk-qcard-actions">
                  <IconButton
                    label="Settings for this question"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(b._id);
                    }}
                  >
                    <Settings2 size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                  <IconButton
                    label="Duplicate this question"
                    onClick={(e) => {
                      e.stopPropagation();
                      void duplicateBlock({ blockId: b._id });
                    }}
                  >
                    <Copy size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                  <IconButton
                    label="Delete this question"
                    tone="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selected === b._id) setSelected(null);
                      void removeBlock({ blockId: b._id });
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                </div>
              </article>
            )}
          </Fragment>
        ))}

        {renderSlot(blocks.length)}

        <div className="fk-canvas-foot">
          <Button
            variant="secondary"
            iconLeft={<Rows3 size={16} strokeWidth={1.8} aria-hidden />}
            onClick={() =>
              addBlock({ formId, kind: "pagebreak", pageName: `Page ${pages.length + 1}` })
            }
          >
            Add a page break
          </Button>
        </div>

        <section className="fk-panel fk-screen" data-tone="mint">
          <div className="fk-screen-label">Thank-you screen</div>
          <Input
            value={form.thanks?.title ?? ""}
            aria-label="Thank-you title"
            placeholder="Thank you"
            onChange={(e) =>
              updateForm({
                formId,
                patch: { thanks: { ...(form.thanks ?? { message: "" }), title: e.target.value } },
              })
            }
          />
          <div style={{ marginTop: 10 }}>
            <Textarea
              rows={2}
              value={form.thanks?.message ?? ""}
              aria-label="Thank-you message"
              placeholder="Your answers are in. We will be in touch."
              onChange={(e) =>
                updateForm({
                  formId,
                  patch: { thanks: { ...(form.thanks ?? { title: "" }), message: e.target.value } },
                })
              }
            />
          </div>
        </section>
      </div>

      {/* ---------- inspector ---------- */}
      <aside className="fk-inspector">
        <section className="fk-panel" data-pad="tight">
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Pages</span>
            <span style={{ fontSize: 12.5, color: "var(--color-text-tertiary)" }}>
              {pages.length} {pages.length === 1 ? "page" : "pages"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pages.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 14,
                  background: "var(--neutral-50)",
                  fontSize: 14,
                }}
              >
                <span style={{ opacity: 0.6 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
                <span style={{ opacity: 0.6, fontSize: 12.5 }}>{p.count}</span>
              </div>
            ))}
          </div>
        </section>

        {active ? (
          <section className="fk-panel" data-pad="tight">
            <h3 style={{ marginBottom: 14 }}>Field settings</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Type">
                <Select
                  value={active.type ?? "short-text"}
                  ariaLabel="Answer type"
                  onChange={(next) =>
                    updateBlock({
                      blockId: active._id,
                      patch: {
                        type: next as Doc<"blocks">["type"],
                        ...(hasOptions(next) && !active.options?.length
                          ? { options: ["First option", "Second option"] }
                          : {}),
                      },
                    })
                  }
                  options={FIELD_TYPES.map((t) => ({ value: t.type, label: t.label, note: t.group }))}
                />
              </Field>

              <Field label="Question">
                <Textarea
                  rows={2}
                  value={active.title ?? ""}
                  onChange={(e) => updateBlock({ blockId: active._id, patch: { title: e.target.value } })}
                />
              </Field>

              <Field label="Help text" help="A line under the question, if it needs one.">
                <Input
                  value={active.help ?? ""}
                  onChange={(e) => updateBlock({ blockId: active._id, patch: { help: e.target.value } })}
                />
              </Field>

              {["short-text", "long-text", "email", "phone", "url", "number"].includes(
                active.type ?? "",
              ) && (
                <Field label="Placeholder">
                  <Input
                    value={active.placeholder ?? ""}
                    onChange={(e) =>
                      updateBlock({ blockId: active._id, patch: { placeholder: e.target.value } })
                    }
                  />
                </Field>
              )}

              {hasOptions(active.type) && (
                <Field
                  label="Options"
                  help="One per line. The order here is the order people see."
                >
                  <Textarea
                    rows={Math.max(3, (active.options ?? []).length + 1)}
                    value={(active.options ?? []).join("\n")}
                    onChange={(e) =>
                      updateBlock({
                        blockId: active._id,
                        patch: {
                          options: e.target.value.split("\n").map((o) => o.trimStart()),
                        },
                      })
                    }
                  />
                </Field>
              )}

              {hasScale(active.type) && (
                <div style={{ display: "flex", gap: 10 }}>
                  {active.type === "scale" && (
                    <Field label="From">
                      <Input
                        type="number"
                        value={active.scaleMin ?? 1}
                        onChange={(e) =>
                          updateBlock({
                            blockId: active._id,
                            patch: { scaleMin: Number(e.target.value) },
                          })
                        }
                      />
                    </Field>
                  )}
                  <Field label="To">
                    <Input
                      type="number"
                      value={active.scaleMax ?? 5}
                      onChange={(e) =>
                        updateBlock({
                          blockId: active._id,
                          patch: { scaleMax: Number(e.target.value) },
                        })
                      }
                    />
                  </Field>
                </div>
              )}

              {active.type === "file" && (
                <Field label="What they may attach" help="Leave everything off to accept anything up to 10 MB.">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {["Images", "PDF", "Documents", "Spreadsheets"].map((kind) => (
                      <Checkbox
                        key={kind}
                        label={kind}
                        checked={(active.accept ?? []).includes(kind)}
                        onChange={(on) =>
                          updateBlock({
                            blockId: active._id,
                            patch: {
                              accept: on
                                ? [...(active.accept ?? []), kind]
                                : (active.accept ?? []).filter((a) => a !== kind),
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                </Field>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ flex: 1, fontSize: 14.5 }}>Required</span>
                <Switch
                  checked={!!active.required}
                  label="Required"
                  onChange={(on) => updateBlock({ blockId: active._id, patch: { required: on } })}
                />
              </div>

              {appliedRules.length > 0 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Logic on this question</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {appliedRules.map((r) => (
                      <div key={r._id} className="fk-subrow" style={{ alignItems: "center" }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>{r.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const said = await unapply({ ruleId: r._id, blockId: active._id });
                            toast("Rule updated", { detail: said });
                          }}
                        >
                          Unapply
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: "10px 2px 0", fontSize: 13, color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
                    Unapplying clears this question from the rule. The rule itself stays on the
                    Logic page.
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="fk-panel" data-pad="tight">
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--color-text-tertiary)" }}>
              Pick a question on the left and its settings appear here.
            </p>
          </section>
        )}
      </aside>
    </div>
  );
}
