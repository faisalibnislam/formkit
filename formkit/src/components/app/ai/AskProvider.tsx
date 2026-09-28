"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { aiIntent, aiPlan } from "../../../../convex/model/aiIntent";
import { useToast } from "@/components/ui/Toast";

/**
 * Ask Formkit's working state, shared by the full page and the drawer so one
 * conversation carries between them. The thread, the canvas and a pending
 * draft are kept in this browser per person, so a reload or a trip to the
 * builder does not lose them.
 *
 * Only an account on the allow-list ever mounts this; see AppShell.
 */

export type AskResult = FunctionReturnType<typeof api.ai.run>;
export type Draft = Extract<AskResult, { kind: "draft" }>["draft"];

export type Message = { id: string; from: "user" | "fk"; text: string; note?: string };

export type Canvas =
  | { kind: "draft"; draft: Draft; revised: boolean }
  | Extract<AskResult, { kind: "added" | "rules" | "theme" | "insight" }>
  | (Extract<AskResult, { kind: "diff" }> & { applied?: boolean });

export type Attachment = {
  kind: "brief" | "form" | "file";
  label: string;
  text?: string;
  formId?: Id<"forms">;
  storageId?: Id<"_storage">;
  mime?: string;
};

type Saved = { thread: Message[]; canvas: Canvas | null; target: string };

type Ask = {
  thread: Message[];
  canvas: Canvas | null;
  busy: boolean;
  plan: { text: string; done: boolean }[];
  /** How many canvas rows have been revealed, for the one-by-one entrance. */
  shown: number;
  attach: Attachment | null;
  setAttach: (a: Attachment | null) => void;
  /** The form being worked on from the page: a form id, or "new". */
  target: string;
  setTarget: (t: string) => void;
  /** The form any request is about: the open form in the builder, else the target. */
  formId: Id<"forms"> | null;
  left: number;
  limit: number;
  limitOpen: boolean;
  setLimitOpen: (open: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  send: (text: string) => Promise<void>;
  commit: () => Promise<void>;
  discard: () => void;
  applyRewrite: () => Promise<void>;
  newChat: () => void;
};

const AskContext = createContext<Ask | null>(null);

export function useAsk() {
  const ask = useContext(AskContext);
  if (!ask) throw new Error("useAsk is only available inside AskProvider.");
  return ask;
}

/** Null when the account does not have Ask Formkit. */
export function useAskMaybe() {
  return useContext(AskContext);
}

const KEY = "fk.ask.v1.";

function load(userId: string): Saved {
  try {
    const raw = window.localStorage.getItem(KEY + userId);
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      return { thread: s.thread ?? [], canvas: s.canvas ?? null, target: s.target ?? "new" };
    }
  } catch {
    /* private window or cleared storage: start fresh */
  }
  return { thread: [], canvas: null, target: "new" };
}

function reduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
}

let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export function nextMonthLabel() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function AskProvider({
  userId,
  limit,
  used,
  children,
}: {
  userId: string;
  limit: number;
  used: number;
  children: ReactNode;
}) {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const run = useAction(api.ai.run);
  const commitDraft = useMutation(api.ai.commit);
  const rewrite = useMutation(api.ai.applyRewrite);

  const [saved] = useState(() => load(userId));
  const [thread, setThread] = useState<Message[]>(saved.thread);
  const [canvas, setCanvas] = useState<Canvas | null>(saved.canvas);
  const [target, setTarget] = useState(saved.target);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{ text: string; done: boolean }[]>([]);
  const [shown, setShown] = useState(Number.MAX_SAFE_INTEGER);
  const [attach, setAttach] = useState<Attachment | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const timers = useRef<number[]>([]);

  // The form the builder has open wins over the page's picker.
  const editing = /^\/app\/forms\/([^/?#]+)/.exec(pathname ?? "")?.[1] as Id<"forms"> | undefined;
  const forms = useQuery(api.forms.picker, {});
  const pickable = target !== "new" && forms?.some((f) => f._id === target);
  const formId = editing ?? (pickable ? (target as Id<"forms">) : null);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY + userId, JSON.stringify({ thread: thread.slice(-60), canvas, target }));
    } catch {
      /* storage full or blocked: the conversation just will not survive a reload */
    }
  }, [userId, thread, canvas, target]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const say = useCallback((text: string, note?: string) => {
    setThread((t) => [...t, { id: nextId(), from: "fk", text, note }]);
  }, []);

  /** Canvas rows arrive one at a time, unless motion is reduced. */
  const reveal = useCallback((count: number) => {
    clearTimers();
    if (reduced()) {
      setShown(Number.MAX_SAFE_INTEGER);
      return;
    }
    setShown(0);
    for (let i = 1; i <= count; i++) {
      timers.current.push(window.setTimeout(() => setShown(i), 120 + i * 170));
    }
    timers.current.push(window.setTimeout(() => setShown(Number.MAX_SAFE_INTEGER), 120 + (count + 1) * 170));
  }, []);

  const left = Math.max(0, limit - used);
  const draft = canvas?.kind === "draft" ? canvas.draft : null;

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      const intent = aiIntent(text, { hasForm: Boolean(formId), hasDraft: Boolean(draft) });
      if (intent === "create" && left <= 0) {
        setLimitOpen(true);
        return;
      }
      const sending = attach;
      const history = thread.slice(-8).map((m) => ({ from: m.from, text: m.text }));
      setThread((t) => [
        ...t,
        {
          id: nextId(),
          from: "user",
          text: sending?.kind === "form" ? `${text} — based on ${sending.label}` : text,
          note: sending && sending.kind !== "form" ? sending.label : undefined,
        },
      ]);
      setAttach(null);
      setBusy(true);

      const steps = aiPlan(intent, sending?.kind === "file" ? sending.label : sending?.kind === "brief" ? "your brief" : undefined);
      setPlan(steps.map((s) => ({ text: s, done: false })));
      clearTimers();
      // Every step but the last ticks off on a clock; the last waits for the answer.
      steps.slice(0, -1).forEach((_, i) => {
        timers.current.push(
          window.setTimeout(
            () => setPlan((p) => p.map((row, j) => (j <= i ? { ...row, done: true } : row))),
            reduced() ? 0 : 700 + i * 1100,
          ),
        );
      });

      try {
        const result = await run({
          text,
          formId: formId ?? undefined,
          draft: intent === "create" ? undefined : (draft ?? undefined),
          attach: sending ?? undefined,
          history,
        });
        clearTimers();
        setPlan([]);
        switch (result.kind) {
          case "chat":
          case "say":
            say(result.text, result.note);
            break;
          case "limit":
            setLimitOpen(true);
            say(`You have used all ${result.limit} form credits this month. Changing the forms you have is still free.`);
            break;
          case "draft": {
            setCanvas({ kind: "draft", draft: result.draft, revised: result.revised });
            const n = result.draft.items.filter((i) => i.kind === "field").length;
            const paged = result.draft.items.some((i) => i.kind === "pagebreak");
            reveal(result.draft.items.length);
            say(
              result.revised
                ? `${result.note ?? "Changed."} ${n} questions now.`
                : `${n} ${n === 1 ? "question" : "questions"}, ${paged ? "across a few pages" : "on one page"}. ${
                    result.note ?? "Open it in the builder, or tell me what to change."
                  }`,
              result.revised ? "Free — changing a draft never costs a credit" : `${result.limit - result.used} of ${result.limit} credits left`,
            );
            break;
          }
          case "added":
            setCanvas(result);
            reveal(result.items.length);
            say(
              `Added ${result.items.length} ${result.items.length === 1 ? "question" : "questions"} to ${result.title}, at the end.`,
              "Free — refining never costs a credit",
            );
            break;
          case "rules":
            setCanvas(result);
            reveal(result.items.length);
            say(
              result.items.length === 1 ? "One rule, live on the form now." : `${result.items.length} rules, live on the form now.`,
              "Edit them on the Logic tab",
            );
            break;
          case "theme":
            setCanvas(result);
            reveal(1);
            say(`Set to ${result.name}.${result.brand ? " Your brand colour is the accent." : ""}`, "See it on the Design tab");
            break;
          case "diff":
            setCanvas(result);
            reveal(result.items.length);
            say(
              `${result.items.length} ${result.items.length === 1 ? "question would change" : "questions would change"}. Nothing is saved until you apply it.`,
            );
            break;
          case "insight":
            setCanvas(result);
            reveal(result.items.length);
            say(result.text);
            break;
        }
      } catch (e) {
        clearTimers();
        setPlan([]);
        const message = e instanceof Error ? e.message.replace(/^[\s\S]*Uncaught Error:\s*/, "").split("\n")[0] : "";
        say(message || "That did not go through. Try again in a moment.", "Nothing spent");
      } finally {
        setBusy(false);
      }
    },
    [attach, busy, draft, formId, left, reveal, run, say, thread],
  );

  const commit = useCallback(async () => {
    if (!draft) return;
    try {
      const id = await commitDraft({ draft });
      const n = draft.items.filter((i) => i.kind === "field").length;
      setCanvas(null);
      setTarget(id);
      setDrawerOpen(false);
      toast("Form created", { detail: `${draft.title} — ${n} ${n === 1 ? "question" : "questions"}` });
      say(`${draft.title} is in your forms as a draft. Ask me for logic, a theme or a different tone.`);
      router.push(`/app/forms/${id}`);
    } catch (e) {
      toast("Could not create the form", { detail: e instanceof Error ? e.message : undefined, tone: "error" });
    }
  }, [commitDraft, draft, router, say, toast]);

  const discard = useCallback(() => {
    clearTimers();
    setCanvas(null);
  }, []);

  const applyRewrite = useCallback(async () => {
    if (canvas?.kind !== "diff" || canvas.applied) return;
    try {
      const changed = await rewrite({
        formId: canvas.formId,
        items: canvas.items.map((i) => ({ blockId: i.blockId, title: i.after })),
      });
      setCanvas({ ...canvas, applied: true });
      say(`Applied to ${changed} ${changed === 1 ? "question" : "questions"}.`);
      toast("Questions rewritten", { detail: canvas.title });
    } catch (e) {
      toast("Could not apply the rewrite", { detail: e instanceof Error ? e.message : undefined, tone: "error" });
    }
  }, [canvas, rewrite, say, toast]);

  const newChat = useCallback(() => {
    clearTimers();
    setThread([]);
    setCanvas(null);
    setAttach(null);
    setPlan([]);
  }, []);

  const value = useMemo<Ask>(
    () => ({
      thread,
      canvas,
      busy,
      plan,
      shown,
      attach,
      setAttach,
      target,
      setTarget,
      formId,
      left,
      limit,
      limitOpen,
      setLimitOpen,
      drawerOpen,
      setDrawerOpen,
      send,
      commit,
      discard,
      applyRewrite,
      newChat,
    }),
    [thread, canvas, busy, plan, shown, attach, target, formId, left, limit, limitOpen, drawerOpen, send, commit, discard, applyRewrite, newChat],
  );

  return <AskContext.Provider value={value}>{children}</AskContext.Provider>;
}
