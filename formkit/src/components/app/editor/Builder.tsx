"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  GitBranch,
  GripVertical,
  Lock,
  MessageSquare,
  Plus,
  Rows3,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { Button, IconButton, Input, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { DraftInput, DraftTextarea } from "./Draft";
import { FieldIcon } from "./FieldIcon";
import { FieldPicker } from "./FieldPicker";
import { FieldSettings, NothingSelected, PageSettings } from "./Inspector";
import { QuestionPreview } from "./QuestionPreview";
import { FIELD_GROUPS, defaultTitle, fieldType, matchFieldTypes } from "./fieldTypes";
import { openComments, setCurrentBlock, usePresence } from "./collab";
import { tracked } from "./saveStatus";
import { PageSkeleton } from "../Skeleton";

/**
 * The builder: field library, canvas, inspector.
 *
 * Questions and page breaks are one ordered list, because that is what the
 * canvas shows. Reordering sends the whole new order in one mutation rather
 * than a pair of swaps, so a dropped card never lands twice.
 *
 * Dragging, of which there are two kinds: a field type dragged in from the
 * library, and a block dragged to a new place. Both land either on an insert
 * point between two blocks or on a card, whose top or bottom half says
 * whether the drop goes before or after it — a line shows which.
 *
 * A card is ALWAYS `draggable`, and `onCardPointerDown` decides whether the
 * press that began may start a drag. Do not go back to setting `draggable`
 * from state on mousedown — the browser reads the attribute before that state
 * lands, and the drag never starts. Every drag also writes something into
 * `dataTransfer`, because Firefox refuses to begin one that carries nothing.
 */

/* A press that lands on one of these is that control's, not the card's:
   without this, selecting the text in a page name starts a drag instead. */
const CONTROLS =
  "input, textarea, select, button, a, [contenteditable], [role='button'], [role='menuitem'], [role='switch']";

/** What a drag is carrying. */
type Payload = { kind: "block"; id: string } | { kind: "new"; type: string };

type Block = Doc<"blocks">;

/** A page, as the rail lists it: a run of blocks that starts at a break. */
type Run = {
  /** The page break that opens it; null for the questions before the first. */
  id: Id<"blocks"> | null;
  title: string;
  /** The block the rail jumps to. */
  anchor: Id<"blocks">;
  count: number;
  ids: Id<"blocks">[];
};

function pageRuns(blocks: Block[]): Run[] {
  const runs: Run[] = [];
  for (const b of blocks) {
    if (b.kind === "pagebreak" || runs.length === 0) {
      const isBreak = b.kind === "pagebreak";
      runs.push({
        id: isBreak ? b._id : null,
        title: isBreak ? b.pageName || "Untitled page" : "First page",
        anchor: b._id,
        count: isBreak ? 0 : 1,
        ids: [b._id],
      });
    } else {
      runs[runs.length - 1]!.count++;
      runs[runs.length - 1]!.ids.push(b._id);
    }
  }
  return runs;
}

function scrollToBlock(id: string) {
  const el = document.getElementById(id === "welcome" ? "fk-welcome" : `blk-${id}`);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 96;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth",
  });
}

export function Builder({ formId }: { formId: Id<"forms"> }) {
  const toast = useToast();
  const form = useQuery(api.forms.get, { formId });
  const rules = useQuery(api.logic.list, { formId });
  const commentCounts = useQuery(api.comments.counts, { formId });
  const others = usePresence(formId);
  const onComment = (blockId: Id<"blocks">) => openComments(blockId);

  /* Who else is on which question, for the ring and the name on the card. */
  const presence: Record<string, { name: string; color: string }[]> = {};
  for (const p of others) {
    if (p.blockId) (presence[p.blockId] ??= []).push({ name: p.name, color: p.color });
  }

  const addBlock = useMutation(api.blocks.add);
  const updateBlock = useMutation(api.blocks.update);
  const removeBlock = useMutation(api.blocks.remove);
  const removePage = useMutation(api.blocks.removePage);
  const duplicateBlock = useMutation(api.blocks.duplicate);
  const duplicatePage = useMutation(api.blocks.duplicatePage);
  const reorder = useMutation(api.blocks.reorder);
  const updateForm = useMutation(api.forms.update);

  const [libTerm, setLibTerm] = useState("");
  const [selected, setSelected] = useState<Id<"blocks"> | null>(null);
  /** Where the field picker will insert, when it is open. */
  const [pickerAt, setPickerAt] = useState<number | null>(null);
  const [pageDel, setPageDel] = useState<{ id: Id<"blocks">; title: string; count: number } | null>(
    null,
  );

  const blocks = useMemo(() => form?.blocks ?? [], [form]);

  // Others see which question this person is on.
  useEffect(() => {
    setCurrentBlock(selected);
    return () => setCurrentBlock(null);
  }, [selected]);
  const active = blocks.find((b) => b._id === selected) ?? null;
  const library = matchFieldTypes(libTerm);

  /* What is in flight: a block being moved, or a field type from the library.
     A ref, because the drop handler runs from a browser event and cannot wait
     for a render to commit. */
  const payload = useRef<Payload | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [overCard, setOverCard] = useState<{ id: string; before: boolean } | null>(null);
  const [pageDrag, setPageDrag] = useState<number | null>(null);
  const [pageOver, setPageOver] = useState<number | null>(null);

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
    e.dataTransfer.setData("text/plain", `fk-field:${type}`);
    e.dataTransfer.effectAllowed = "copy";
    setDragging("new");
  }

  function onDragFinished() {
    payload.current = null;
    gripArm.current = false;
    setDragging(null);
    setOverSlot(null);
    setOverCard(null);
  }

  /** After the selected block, or at the end. */
  const insertIndex = () => {
    if (!selected) return blocks.length;
    const i = blocks.findIndex((b) => b._id === selected);
    return i < 0 ? blocks.length : i + 1;
  };

  async function add(type: string, at?: number) {
    const meta = fieldType(type);
    setPickerAt(null);
    const id = await tracked(
      addBlock({
        formId,
        kind: "field",
        at: at ?? insertIndex(),
        type: type as Block["type"],
        title: defaultTitle(type),
        options: meta.defaultOptions,
        ...(meta.preview === "scale" ? { scaleMin: 1, scaleMax: 5 } : {}),
        ...(meta.preview === "rating" ? { scaleMax: 5 } : {}),
      }),
    );
    if (id) setSelected(id);
    toast("Question added", { detail: meta.label });
  }

  async function addPage(at?: number) {
    const id = await tracked(
      addBlock({ formId, kind: "pagebreak", at, pageName: "New page" }),
    );
    if (id) setSelected(id);
    return id;
  }

  const order = () => blocks.map((b) => b._id);

  /* Every drop names a slot between two blocks — an insert point directly, or
     a card's top or bottom half — so where the block lands is never a guess. */
  async function dropAtSlot(slot: number) {
    const inFlight = payload.current;
    onDragFinished();
    if (!inFlight) return;

    if (inFlight.kind === "new") {
      await add(inFlight.type, slot);
      return;
    }

    const ids = order() as string[];
    const from = ids.indexOf(inFlight.id);
    if (from < 0) return;
    const rest = ids.filter((id) => id !== inFlight.id);
    // Removing the block first shifts every slot after it left by one.
    const to = from < slot ? slot - 1 : slot;
    if (to === from) return;
    rest.splice(to, 0, inFlight.id);
    setSelected(inFlight.id as Id<"blocks">);
    await tracked(reorder({ formId, ids: rest as Id<"blocks">[] }));
  }

  async function nudge(id: Id<"blocks">, dir: -1 | 1) {
    const ids = order();
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    setSelected(id);
    await tracked(reorder({ formId, ids }));
  }

  async function movePage(from: number, to: number) {
    setPageDrag(null);
    setPageOver(null);
    const runs = pageRuns(blocks);
    const lead = runs.length && runs[0]!.id === null ? 1 : 0;
    if (from < lead || from >= runs.length) return;
    const dest = Math.min(Math.max(to, lead), runs.length - 1);
    if (dest === from) return;
    const [moved] = runs.splice(from, 1);
    runs.splice(dest, 0, moved!);
    await tracked(reorder({ formId, ids: runs.flatMap((r) => r.ids) }));
    toast("Pages reordered");
  }

  async function confirmPageDelete() {
    if (!pageDel) return;
    const { id } = pageDel;
    setPageDel(null);
    const run = pageRuns(blocks).find((r) => r.id === id);
    if (run && selected && run.ids.includes(selected)) setSelected(null);
    const questions = await tracked(removePage({ blockId: id }));
    toast("Page deleted", {
      detail: (questions ?? pageDel.count) > 0 ? "Its questions went with it" : "The page break is gone",
    });
  }

  async function deleteQuestion(id: Id<"blocks">) {
    if (selected === id) setSelected(null);
    await tracked(removeBlock({ blockId: id }));
    toast("Question deleted", { detail: "That one is gone." });
  }

  async function duplicate(id: Id<"blocks">) {
    const copy = await tracked(duplicateBlock({ blockId: id }));
    if (copy) setSelected(copy);
    toast("Duplicated");
  }

  if (!form) return <PageSkeleton kind="editor" label="Opening the form" />;

  const runs = pageRuns(blocks);
  const breaks = blocks.filter((b) => b.kind === "pagebreak").length;
  const firstBreak = blocks.findIndex((b) => b.kind === "pagebreak");
  const totalPages = 1 + (breaks === 0 ? 1 : firstBreak > 0 ? breaks + 1 : breaks);
  const welcomeStandalone = blocks[0]?.kind === "pagebreak";
  const pageNumber = (id: string) =>
    String(runs.findIndex((r) => r.id === id) + 2).padStart(2, "0");

  /* Questions are numbered; page breaks are not, so a number always names the
     question a respondent would count. */
  const numbers = new Map<string, number>();
  let counted = 0;
  for (const b of blocks) if (b.kind !== "pagebreak") numbers.set(b._id, ++counted);

  const fields = blocks.filter((b) => b.kind === "field");
  const ruleCount = (id: string) =>
    (rules ?? []).filter((r) => r.targetId === id || r.conditions.some((c) => c.blockId === id))
      .length;

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
        e.stopPropagation();
        e.dataTransfer.dropEffect = payload.current?.kind === "new" ? "copy" : "move";
        setOverCard(null);
        setOverSlot(index);
      }}
      onDragLeave={() => setOverSlot((v) => (v === index ? null : v))}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void dropAtSlot(index);
      }}
    >
      <span className="fk-insert-rule" />
      <button type="button" className="fk-insert-pill" onClick={() => setPickerAt(index)}>
        <Plus size={15} strokeWidth={2.2} aria-hidden />
        Add field
      </button>
      <span className="fk-insert-rule" />
    </div>
  );

  /** A card is a drop target too: its top half drops before it, the bottom after. */
  const cardDrop = (b: Block, i: number) => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!payload.current) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = payload.current.kind === "new" ? "copy" : "move";
      const r = e.currentTarget.getBoundingClientRect();
      const before = e.clientY - r.top < r.height / 2;
      setOverSlot(null);
      if (overCard?.id !== b._id || overCard.before !== before) setOverCard({ id: b._id, before });
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      setOverCard((v) => (v?.id === b._id ? null : v));
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      const before = e.clientY - r.top < r.height / 2;
      void dropAtSlot(before ? i : i + 1);
    },
  });

  const indicator = (b: Block) => {
    // "new" is a library drag, which may land anywhere; a card never on itself.
    const showing = overCard?.id === b._id && dragging !== null && dragging !== b._id;
    if (!showing) return null;
    return <span className="fk-dropline" data-at={overCard!.before ? "before" : "after"} />;
  };

  const patchWelcome = (p: Partial<{ title: string; message: string; button: string }>) =>
    tracked(
      updateForm({
        formId,
        patch: { welcome: { title: "", message: "", ...(form.welcome ?? {}), ...p } },
      }),
    );
  const patchThanks = (p: Partial<{ title: string; message: string }>) =>
    tracked(
      updateForm({
        formId,
        patch: { thanks: { title: "", message: "", ...(form.thanks ?? {}), ...p } },
      }),
    );

  const activeRun = active?.kind === "pagebreak" ? runs.find((r) => r.id === active._id) : null;

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
        <p className="fk-library-lede">Drag a field in, or click to add</p>

        <div className="fk-library">
          {library.length === 0 && (
            <p className="fk-library-lede">Nothing matches “{libTerm}”.</p>
          )}
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
        </div>
      </aside>

      {/* ---------- canvas ---------- */}
      <div className="fk-canvas">
        <section id="fk-welcome" className="fk-panel fk-screen">
          <div className="fk-screen-label">Welcome screen · what people see first</div>
          <DraftInput
            className="fk-inline-edit"
            data-size="h2"
            title="Click to edit"
            aria-label="Welcome title"
            placeholder="Give this form a title"
            value={form.welcome?.title ?? ""}
            onCommit={(title) => patchWelcome({ title })}
          />
          <DraftTextarea
            className="fk-inline-edit"
            data-size="lede"
            rows={2}
            title="Click to edit"
            aria-label="Welcome message"
            placeholder="Add a line about what this form is for"
            value={form.welcome?.message ?? ""}
            onCommit={(message) => patchWelcome({ message })}
          />
          {welcomeStandalone && (
            <div className="fk-welcome-cta">
              <DraftInput
                className="fk-welcome-button"
                aria-label="Start button label"
                title="Click to edit the button label"
                value={form.welcome?.button ?? "Start"}
                onCommit={(button) => patchWelcome({ button: button || "Start" })}
              />
              <span className="fk-proprow-hint" style={{ flex: 1, minWidth: 180 }}>
                Only you see this note — it never appears on the form. This page stands alone:
                people read it, press the button, and the questions start on page 02.
              </span>
            </div>
          )}
        </section>

        {!welcomeStandalone && (
          <div style={{ display: "flex", justifyContent: "center", margin: "10px 0 2px" }}>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Rows3 size={15} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                await addPage(0);
                toast("Page break added", {
                  detail: "Everything after the welcome screen starts on page 2",
                });
              }}
            >
              Page break after welcome
            </Button>
          </div>
        )}

        {blocks.map((b, i) => (
          <Fragment key={b._id}>
            {renderSlot(i)}
            {b.kind === "pagebreak" ? (
              <div
                id={`blk-${b._id}`}
                className="fk-pagebreak"
                data-selected={b._id === selected ? "true" : undefined}
                data-dragging={b._id === dragging ? "true" : undefined}
                draggable
                onPointerDown={onCardPointerDown}
                onDragStart={(e) => onCardDragStart(e, b._id)}
                onDragEnd={onDragFinished}
                onClick={() => setSelected(b._id)}
                {...cardDrop(b, i)}
              >
                {indicator(b)}
                <span className="fk-pagebreak-no">{pageNumber(b._id)}</span>
                <DraftInput
                  className="fk-pagebreak-name"
                  aria-label="Page name"
                  placeholder="Untitled page"
                  value={b.pageName ?? ""}
                  onCommit={(pageName) =>
                    tracked(updateBlock({ blockId: b._id, patch: { pageName } }))
                  }
                />
                <span className="fk-pagebreak-label">Page break</span>
                <IconButton label="Move page up" disabled={i === 0} onClick={() => nudge(b._id, -1)}>
                  <ChevronUp size={16} strokeWidth={1.8} aria-hidden />
                </IconButton>
                <IconButton
                  label="Move page down"
                  disabled={i >= blocks.length - 1}
                  onClick={() => nudge(b._id, 1)}
                >
                  <ChevronDown size={16} strokeWidth={1.8} aria-hidden />
                </IconButton>
                <IconButton
                  label="Duplicate page"
                  onClick={async () => {
                    const copy = await tracked(duplicatePage({ blockId: b._id }));
                    if (copy) setSelected(copy);
                    toast("Page duplicated");
                  }}
                >
                  <Copy size={15} strokeWidth={1.8} aria-hidden />
                </IconButton>
                <IconButton
                  label="Delete page"
                  onClick={() => {
                    const run = runs.find((r) => r.id === b._id);
                    setPageDel({ id: b._id, title: run?.title ?? "this page", count: run?.count ?? 0 });
                  }}
                >
                  <Trash2 size={15} strokeWidth={1.8} aria-hidden />
                </IconButton>
                <span
                  className="fk-pagebreak-grip"
                  aria-hidden
                  title="Drag to reorder"
                  onMouseEnter={() => {
                    gripArm.current = true;
                  }}
                >
                  <GripVertical size={16} strokeWidth={1.8} />
                </span>
              </div>
            ) : (
              <article
                id={`blk-${b._id}`}
                className="fk-qcard"
                data-selected={b._id === selected ? "true" : undefined}
                data-dragging={b._id === dragging ? "true" : undefined}
                style={
                  presence?.[b._id]?.[0]
                    ? { boxShadow: `inset 0 0 0 2px ${presence[b._id]![0]!.color}, var(--shadow-md)` }
                    : undefined
                }
                onClick={() => setSelected(b._id)}
                draggable
                onPointerDown={onCardPointerDown}
                onDragStart={(e) => onCardDragStart(e, b._id)}
                onDragEnd={onDragFinished}
                {...cardDrop(b, i)}
              >
                {indicator(b)}
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
                    {ruleCount(b._id) > 0 && (
                      <span className="fk-qcard-logic">
                        <GitBranch size={12} strokeWidth={1.9} aria-hidden />
                        Logic
                      </span>
                    )}
                    {(commentCounts?.[b._id] ?? 0) > 0 && (
                      <button
                        type="button"
                        className="fk-qcard-comments"
                        title={`${commentCounts![b._id]} open ${commentCounts![b._id] === 1 ? "comment" : "comments"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(b._id);
                          onComment(b._id);
                        }}
                      >
                        <MessageSquare size={12} strokeWidth={2} aria-hidden />
                        {commentCounts![b._id]}
                      </button>
                    )}
                    {(presence?.[b._id] ?? []).map((p) => (
                      <span
                        key={p.name}
                        className="fk-qcard-presence"
                        style={{ background: p.color }}
                        title={`${p.name} is editing this question`}
                      >
                        <span>
                          {p.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                        {p.name.split(" ")[0]} is editing
                      </span>
                    ))}
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
                      void duplicate(b._id);
                    }}
                  >
                    <Copy size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                  <IconButton
                    label="Delete this question"
                    tone="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteQuestion(b._id);
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                </div>

                <div className="fk-qcard-tools" onClick={(e) => e.stopPropagation()}>
                  <span
                    className="fk-qcard-tools-grip"
                    aria-hidden
                    title="Drag to reorder"
                    onMouseEnter={() => {
                      gripArm.current = true;
                    }}
                  >
                    <GripVertical size={15} strokeWidth={1.8} />
                  </span>
                  <IconButton label="Move up" disabled={i === 0} onClick={() => nudge(b._id, -1)}>
                    <ChevronUp size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={i >= blocks.length - 1}
                    onClick={() => nudge(b._id, 1)}
                  >
                    <ChevronDown size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                  <IconButton
                    label="Comment on this question"
                    onClick={() => {
                      setSelected(b._id);
                      onComment(b._id);
                    }}
                  >
                    <MessageSquare size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                </div>
              </article>
            )}
          </Fragment>
        ))}

        {renderSlot(blocks.length)}

        {dragging === "new" && (
          <div
            className="fk-enddrop"
            data-on={overSlot === -1 ? "true" : undefined}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setOverCard(null);
              setOverSlot(-1);
            }}
            onDragLeave={() => setOverSlot((v) => (v === -1 ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              void dropAtSlot(blocks.length);
            }}
          >
            Drop here to add at the end
          </div>
        )}

        <div className="fk-canvas-foot">
          <Button
            iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />}
            onClick={() => setPickerAt(insertIndex())}
          >
            Add question
          </Button>
          <Button
            variant="secondary"
            iconLeft={<Rows3 size={16} strokeWidth={1.8} aria-hidden />}
            onClick={() => addPage()}
          >
            Add page
          </Button>
        </div>

        <section className="fk-screen fk-screen-thanks">
          <div className="fk-screen-label">Thank-you screen</div>
          <DraftInput
            className="fk-inline-edit"
            data-size="h3"
            title="Click to edit"
            aria-label="Thank-you title"
            placeholder="Thank you"
            value={form.thanks?.title ?? ""}
            onCommit={(title) => patchThanks({ title })}
          />
          <DraftTextarea
            className="fk-inline-edit"
            data-size="body"
            rows={2}
            title="Click to edit"
            aria-label="Thank-you message"
            placeholder="Your answers are in. We will be in touch."
            value={form.thanks?.message ?? ""}
            onCommit={(message) => patchThanks({ message })}
          />
        </section>
      </div>

      {/* ---------- inspector ---------- */}
      <aside className="fk-inspector">
        <section className="fk-panel" data-pad="tight">
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Pages</span>
            <span style={{ fontSize: 12.5, color: "var(--color-text-tertiary)" }}>
              {totalPages} pages
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="fk-pagechip-row">
              <span className="fk-pagechip-lead" title="Always the first page">
                <Lock size={13} strokeWidth={1.8} aria-hidden />
              </span>
              <button
                type="button"
                className="fk-pagechip"
                data-active={selected === null ? "true" : undefined}
                onClick={() => {
                  setSelected(null);
                  scrollToBlock("welcome");
                }}
              >
                <span className="fk-pagechip-no">01</span>
                <span className="fk-pagechip-title">Welcome screen</span>
                <span className="fk-pagechip-count">Intro · locked first</span>
              </button>
            </div>
            {runs.map((r, i) => {
              const draggable = r.id !== null;
              return (
                <div
                  key={r.anchor}
                  className="fk-pagechip-row"
                  data-dragging={pageDrag === i ? "true" : undefined}
                  data-over={
                    pageOver === i && pageDrag !== null && pageDrag !== i ? "true" : undefined
                  }
                  draggable={draggable}
                  onDragStart={(e) => {
                    if (!draggable) return;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `fk-page:${i}`);
                    setPageDrag(i);
                  }}
                  onDragOver={(e) => {
                    if (pageDrag === null) return;
                    e.preventDefault();
                    if (pageOver !== i) setPageOver(i);
                  }}
                  onDrop={(e) => {
                    if (pageDrag === null) return;
                    e.preventDefault();
                    void movePage(pageDrag, i);
                  }}
                  onDragEnd={() => {
                    setPageDrag(null);
                    setPageOver(null);
                  }}
                >
                  <span className="fk-pagechip-lead" data-grip={draggable ? "true" : undefined}>
                    {draggable ? (
                      <GripVertical size={14} strokeWidth={1.8} aria-hidden />
                    ) : (
                      <Lock size={13} strokeWidth={1.8} aria-hidden />
                    )}
                  </span>
                  <button
                    type="button"
                    className="fk-pagechip"
                    data-active={r.ids.includes(selected as Id<"blocks">) ? "true" : undefined}
                    onClick={() => {
                      setSelected(r.anchor);
                      scrollToBlock(r.anchor);
                    }}
                  >
                    <span className="fk-pagechip-no">{String(i + 2).padStart(2, "0")}</span>
                    <span className="fk-pagechip-title">{r.title}</span>
                    <span className="fk-pagechip-count">
                      {r.count === 1 ? "1 question" : `${r.count} questions`}
                    </span>
                  </button>
                  {r.id !== null && (
                    <IconButton
                      label={`Delete ${r.title}`}
                      onClick={() => setPageDel({ id: r.id!, title: r.title, count: r.count })}
                    >
                      <Trash2 size={14} strokeWidth={1.8} aria-hidden />
                    </IconButton>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            style={{ marginTop: 8, paddingLeft: 6 }}
            iconLeft={<Plus size={15} strokeWidth={1.8} aria-hidden />}
            onClick={async () => {
              const id = await addPage();
              if (id) window.setTimeout(() => scrollToBlock(id), 120);
            }}
          >
            Add page
          </Button>
        </section>

        {active?.kind === "field" ? (
          <FieldSettings block={active} fields={fields} rules={rules ?? []} />
        ) : active?.kind === "pagebreak" ? (
          <PageSettings
            block={active}
            count={activeRun?.count ?? 0}
            onDelete={() =>
              setPageDel({
                id: active._id,
                title: activeRun?.title ?? "this page",
                count: activeRun?.count ?? 0,
              })
            }
          />
        ) : (
          <NothingSelected />
        )}
      </aside>

      {pickerAt !== null && (
        <FieldPicker onPick={(type) => add(type, pickerAt)} onClose={() => setPickerAt(null)} />
      )}

      {pageDel && (
        <Modal
          title={`Delete ${pageDel.title}?`}
          description={
            pageDel.count === 0
              ? "The page break goes away and its questions merge into the page above."
              : `The page break and its ${pageDel.count === 1 ? "question" : `${pageDel.count} questions`} will be deleted. This cannot be undone.`
          }
          onClose={() => setPageDel(null)}
          width={460}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPageDel(null)}>
                Keep it
              </Button>
              <Button variant="destructive" onClick={confirmPageDelete}>
                Delete page
              </Button>
            </>
          }
        >
          {null}
        </Modal>
      )}
    </div>
  );
}
