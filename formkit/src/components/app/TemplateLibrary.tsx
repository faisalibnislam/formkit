"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  Bookmark,
  Briefcase,
  CalendarCheck,
  FileText,
  Mail,
  MessageSquare,
  Microscope,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { Button, EmptyState, IconButton, Input } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { CreateFormDialog } from "./CreateFormDialog";

/**
 * The template library: the six Formkit ships with, plus anything saved.
 *
 * A template's plate carries the mark and tint of what it is for, so the shelf
 * reads at a glance rather than as six identical cards.
 */

/** What each topic looks like. An unknown topic falls back to the plain sheet. */
const TOPICS: Record<string, { icon: ReactNode; tint: string }> = {
  Work: { icon: <Briefcase size={30} strokeWidth={1.6} aria-hidden />, tint: "var(--blue-200)" },
  Sales: { icon: <Mail size={30} strokeWidth={1.6} aria-hidden />, tint: "var(--blue-300)" },
  Feedback: { icon: <MessageSquare size={30} strokeWidth={1.6} aria-hidden />, tint: "var(--mint-200)" },
  Events: { icon: <CalendarCheck size={30} strokeWidth={1.6} aria-hidden />, tint: "var(--yellow-200)" },
  Research: { icon: <Microscope size={30} strokeWidth={1.6} aria-hidden />, tint: "var(--green-200)" },
};

const FALLBACK = { icon: <FileText size={30} strokeWidth={1.6} aria-hidden />, tint: "var(--neutral-150)" };

export function TemplateLibrary() {
  const toast = useToast();
  const templates = useQuery(api.templates.list, {});
  const forms = useQuery(api.forms.list, { filter: "all" });
  const remove = useMutation(api.templates.remove);

  const [term, setTerm] = useState("");
  const [topic, setTopic] = useState("all");
  const [pick, setPick] = useState<string | null>(null);

  const topics = useMemo(() => {
    const seen: string[] = [];
    for (const t of templates ?? []) if (!seen.includes(t.topic)) seen.push(t.topic);
    return seen;
  }, [templates]);

  if (!templates) return null;

  const needle = term.trim().toLowerCase();
  const shown = templates
    .filter((t) => (topic === "all" ? true : t.topic === topic))
    .filter((t) =>
      needle ? `${t.name} ${t.blurb} ${t.topic}`.toLowerCase().includes(needle) : true,
    );
  const mine = templates.filter((t) => t.mine);
  const firstForm = forms?.forms?.[0];

  return (
    <>
      <div className="fk-toolbar-panel">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search templates"
          aria-label="Search templates"
          icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
          wrapStyle={{ width: 300 }}
        />
        <span className="fk-range-note">
          {templates.length} {templates.length === 1 ? "template" : "templates"}
        </span>
        <span className="fk-section-spacer" />
        <Button iconLeft={<Plus size={16} strokeWidth={1.8} aria-hidden />} onClick={() => setPick("")}>
          Create form
        </Button>
      </div>

      <section className="fk-panel">
        <div className="fk-section-head" style={{ marginBottom: mine.length ? 14 : 0 }}>
          <h2 style={{ fontSize: 19 }}>Your templates</h2>
          <span className="fk-section-count">{mine.length} saved</span>
        </div>

        {mine.length === 0 ? (
          <div className="fk-hint-row">
            <span className="fk-hint-mark" aria-hidden>
              <Bookmark size={18} strokeWidth={1.8} />
            </span>
            <p>
              Build a form the way you like it, then save it here — open the form, go to Settings,
              and choose Save as template.
            </p>
            {firstForm && (
              <Link href={`/app/forms/${firstForm._id}?tab=settings`}>
                <Button variant="secondary" iconLeft={<FileText size={16} strokeWidth={1.8} aria-hidden />}>
                  Open a form
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="fk-grid" data-cols="cards">
            {mine.map((t) => (
              <TemplateCard
                key={t.slug}
                template={t}
                onUse={() => setPick(t.slug)}
                onDelete={
                  t._id
                    ? async () => {
                        await remove({ templateId: t._id! });
                        toast(`“${t.name}” deleted`);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>

      <div className="fk-filters" role="group" aria-label="Which templates">
        <button type="button" className="fk-filter" aria-pressed={topic === "all"} onClick={() => setTopic("all")}>
          All
        </button>
        {topics.map((t) => (
          <button
            key={t}
            type="button"
            className="fk-filter"
            aria-pressed={topic === t}
            onClick={() => setTopic(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="fk-panel">
          <EmptyState
            title={needle ? `Nothing matches “${term}”` : "Nothing here"}
            description={needle ? "Try a shorter search, or another category." : "Try another category."}
          />
        </div>
      ) : (
        <div className="fk-grid" data-cols="cards">
          {shown.map((t) => (
            <TemplateCard key={t.slug} template={t} onUse={() => setPick(t.slug)} />
          ))}
        </div>
      )}

      {pick !== null && (
        <CreateFormDialog initialTemplate={pick || undefined} onClose={() => setPick(null)} />
      )}
    </>
  );
}

function TemplateCard({
  template,
  onUse,
  onDelete,
}: {
  template: {
    slug: string;
    name: string;
    topic: string;
    blurb: string;
    questions: number;
    pages: number;
    mine: boolean;
  };
  onUse: () => void;
  onDelete?: () => void;
}) {
  const look = TOPICS[template.topic] ?? FALLBACK;
  return (
    <article className="fk-template">
      <div className="fk-template-plate" style={{ background: look.tint }} aria-hidden>
        {look.icon}
      </div>
      <div className="fk-template-body">
        <div className="fk-template-head">
          <h3>{template.name}</h3>
          {onDelete && (
            <IconButton label={`Delete ${template.name}`} tone="danger" onClick={onDelete}>
              <Trash2 size={15} strokeWidth={1.8} aria-hidden />
            </IconButton>
          )}
        </div>
        <p>{template.blurb}</p>
        <div className="fk-template-foot">
          <span>{template.topic}</span>
          <span>·</span>
          <span>
            {template.questions} {template.questions === 1 ? "question" : "questions"}
          </span>
          <span>·</span>
          <span>
            {template.pages} {template.pages === 1 ? "page" : "pages"}
          </span>
        </div>
        <Button size="sm" onClick={onUse}>
          Use this template
        </Button>
      </div>
    </article>
  );
}
