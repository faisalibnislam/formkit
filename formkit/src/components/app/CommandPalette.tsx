"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  ChartPie,
  Copy,
  FileText,
  Inbox,
  LayoutGrid,
  LayoutTemplate,
  Plus,
  Rocket,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Input, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useAskMaybe } from "./ai/AskProvider";

/**
 * Cmd-K. Things to do first — make a form, and, inside the builder, publish
 * it or copy its link — then the person's own forms and the app's sections.
 * Arrow keys move, Enter runs, Escape closes. It does nothing clever with
 * ranking: the shortest honest thing that finds a form by name.
 */
type Entry = {
  key: string;
  label: string;
  meta: string;
  icon: ReactNode;
  group: "Actions" | "Forms" | "Go to";
  /** Extra words it answers to, beyond its label. */
  also?: string;
  run: () => void;
};

const icon = (I: typeof FileText) => <I size={16} strokeWidth={1.8} aria-hidden />;

export function CommandPalette({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const pathname = usePathname() ?? "";
  const ask = useAskMaybe();
  const [term, setTerm] = useState("");
  const [cursor, setCursor] = useState(0);
  const list = useRef<HTMLDivElement | null>(null);
  const data = useQuery(api.forms.list, { filter: "all" });
  const editingId = /^\/app\/forms\/([^/?#]+)/.exec(pathname)?.[1] as Id<"forms"> | undefined;
  const editing = useQuery(api.forms.get, editingId ? { formId: editingId } : "skip");

  const entries = useMemo<Entry[]>(() => {
    const go = (href: string) => () => {
      onClose();
      router.push(href);
    };
    const actions: Entry[] = [
      {
        key: "create",
        label: "Create a form",
        meta: "From scratch or a template",
        icon: icon(Plus),
        group: "Actions",
        also: "new form",
        run: () => {
          onClose();
          onCreate();
        },
      },
    ];
    if (editing) {
      actions.push(
        {
          key: "publish",
          label: editing.status === "published" ? "Publish the latest changes" : "Publish this form",
          meta: editing.title,
          icon: icon(Rocket),
          group: "Actions",
          also: "publish go live",
          run: go(`/app/forms/${editing._id}?open=publish`),
        },
        {
          key: "copy",
          label: "Copy the form link",
          meta: editing.url,
          icon: icon(Copy),
          group: "Actions",
          also: "share url",
          run: () => {
            onClose();
            navigator.clipboard
              .writeText(`https://${editing.url}`)
              .then(() =>
                toast("Link copied", {
                  detail: editing.status === "published" ? editing.url : `${editing.url} — it opens once the form is published`,
                }),
              )
              .catch(() => toast("Formkit could not reach the clipboard", { tone: "error" }));
          },
        },
      );
    }
    if (ask) {
      actions.push({
        key: "ask",
        label: editing ? "Ask Formkit about this form" : "Ask Formkit",
        meta: `${ask.left} form ${ask.left === 1 ? "credit" : "credits"} left`,
        icon: icon(Sparkles),
        group: "Actions",
        also: "ai assistant",
        run: () => {
          onClose();
          if (editing || pathname.startsWith("/app/ask")) {
            if (!pathname.startsWith("/app/ask")) ask.setDrawerOpen(true);
          } else router.push("/app/ask");
        },
      });
    }
    actions.push(
      { key: "responses", label: "Go to responses", meta: "Everything people have sent you", icon: icon(Inbox), group: "Actions", run: go("/app/responses") },
      { key: "analytics", label: "Go to analytics", meta: "Views, finishes and drop-off", icon: icon(ChartPie), group: "Actions", run: go("/app/analytics") },
      { key: "templates", label: "Browse templates", meta: "Start from one that works", icon: icon(LayoutTemplate), group: "Actions", run: go("/app/templates") },
    );

    const forms: Entry[] = (data?.forms ?? []).map((f) => ({
      key: f._id,
      label: f.title,
      meta: `${f.status === "published" ? "Collecting" : f.status === "closed" ? "Closed" : "Draft"} · ${f.questions} questions`,
      icon: icon(FileText),
      group: "Forms",
      run: go(`/app/forms/${f._id}`),
    }));

    const sections: Entry[] = [
      { key: "s-home", label: "Dashboard", meta: "Section", icon: icon(LayoutGrid), group: "Go to", run: go("/app") },
      { key: "s-forms", label: "Forms", meta: "Section", icon: icon(FileText), group: "Go to", run: go("/app/forms") },
      { key: "s-settings", label: "Settings", meta: "Your account, companies and exports", icon: icon(Settings2), group: "Go to", run: go("/app/settings") },
      { key: "s-notify", label: "Notification settings", meta: "Settings", icon: icon(Settings2), group: "Go to", also: "email alerts", run: go("/app/settings?tab=notifications") },
    ];

    const q = term.trim().toLowerCase();
    if (!q) return [...actions, ...forms.slice(0, 5), ...sections];
    return [...actions, ...forms, ...sections].filter((e) => `${e.label} ${e.also ?? ""}`.toLowerCase().includes(q));
  }, [ask, data, editing, onClose, onCreate, pathname, router, term, toast]);

  const at = Math.min(cursor, Math.max(0, entries.length - 1));

  function move(by: number) {
    if (!entries.length) return;
    const next = (at + by + entries.length) % entries.length;
    setCursor(next);
    list.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  }

  let lastGroup = "";
  return (
    <Modal title="Search" onClose={onClose} width={560}>
      <Input
        autoFocus
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setCursor(0);
        }}
        placeholder="Something to do, a form, or where to go"
        icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
        role="combobox"
        aria-expanded
        aria-controls="fk-palette-list"
        aria-activedescendant={entries[at] ? `fk-palette-${entries[at].key}` : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          } else if (e.key === "Enter") {
            e.preventDefault();
            entries[at]?.run();
          }
        }}
      />
      <div ref={list} id="fk-palette-list" role="listbox" aria-label="Results" className="fk-rows fk-palette-list">
        {entries.length === 0 ? (
          <p className="fk-palette-empty">Nothing matches “{term}”. Try a form’s name, or “create”.</p>
        ) : (
          entries.map((e, i) => {
            const heading = e.group !== lastGroup ? e.group : null;
            lastGroup = e.group;
            return (
              <div key={e.key}>
                {heading && <div className="fk-palette-group">{heading}</div>}
                <button
                  type="button"
                  role="option"
                  id={`fk-palette-${e.key}`}
                  data-index={i}
                  aria-selected={i === at}
                  className="fk-row fk-palette-row"
                  onMouseMove={() => i !== at && setCursor(i)}
                  onClick={e.run}
                >
                  {e.icon}
                  <span className="fk-row-main">
                    <span className="fk-row-title">{e.label}</span>
                    <span className="fk-row-meta">{e.meta}</span>
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="fk-palette-keys" aria-hidden>
        <span>↑ ↓ to move</span>
        <span>Enter to open</span>
        <span>Esc to close</span>
      </div>
    </Modal>
  );
}
