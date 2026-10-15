"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { Redo2, Undo2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useToast } from "@/components/ui/Toast";
import { tracked } from "./saveStatus";

/**
 * Undo and redo for the questions, their options, pages and logic
 * (convex/model/history.ts), from the editor header and from ⌘Z / ⇧⌘Z.
 *
 * A question deleted a moment ago is still waiting on its toast's Undo in the
 * builder, so Undo asks the builder first ("fk:undo"); only when nothing is
 * waiting there does it go to the server.
 */
export const UNDO_EVENT = "fk:undo";

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";

export function UndoRedo({ formId }: { formId: Id<"forms"> }) {
  const toast = useToast();
  const state = useQuery(api.history.state, { formId });
  const undo = useMutation(api.history.undo);
  const redo = useMutation(api.history.redo);
  const busy = useRef(false);

  const canUndo = !!state?.undo?.mine;
  const canRedo = !!state?.redo;

  async function run(kind: "undo" | "redo") {
    if (busy.current) return;
    if (kind === "undo" && !window.dispatchEvent(new CustomEvent(UNDO_EVENT, { cancelable: true }))) return;
    busy.current = true;
    try {
      const label = await tracked((kind === "undo" ? undo : redo)({ formId }));
      toast(kind === "undo" ? `Undone: ${label}` : `Redone: ${label}`);
    } catch (e) {
      toast(e instanceof Error ? e.message.replace(/^.*Uncaught Error: /, "").split("\n")[0]! : "That didn't work.", { tone: "error" });
    } finally {
      busy.current = false;
    }
  }

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.defaultPrevented) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      // Text fields keep their own undo.
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], .ui-modal")) return;
      e.preventDefault();
      void runRef.current(key === "y" || e.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!state) return null;
  const undoTitle = state.undo
    ? state.undo.mine
      ? `Undo: ${state.undo.label} (${MOD}Z)`
      : "Someone else changed the form since, so there is nothing of yours to undo"
    : "Nothing to undo";
  const redoTitle = state.redo ? `Redo: ${state.redo.label} (${MOD}⇧Z)` : "Nothing to redo";

  return (
    <span className="fk-undo">
      <button type="button" aria-label={undoTitle} title={undoTitle} disabled={!canUndo} onClick={() => void run("undo")}>
        <Undo2 size={15} strokeWidth={1.9} aria-hidden />
      </button>
      <button type="button" aria-label={redoTitle} title={redoTitle} disabled={!canRedo} onClick={() => void run("redo")}>
        <Redo2 size={15} strokeWidth={1.9} aria-hidden />
      </button>
    </span>
  );
}
