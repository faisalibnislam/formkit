"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Check, Search } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button, Field, Input, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { TEMPLATE_TOPICS } from "./dialogs/SaveTemplateDialog";
import { TemplateIcon } from "./TemplateIcon";

/**
 * Creating a form: a name, and blank or a template to start from. Which
 * identity it publishes under follows the account's defaults and is changed
 * later under Design → Branding - it is not asked for here.
 */
export function CreateFormDialog({
  onClose,
  initialTemplate,
}: {
  onClose: () => void;
  initialTemplate?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const templates = useQuery(api.templates.list, {});
  const create = useMutation(api.forms.create);

  const [pick, setPick] = useState<string>(initialTemplate ?? "blank");
  const [name, setName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const [busy, setBusy] = useState(false);

  const all = templates ?? [];
  const mine = all.filter((t) => t.mine);
  const chosen = all.find((t) => t.slug === pick) ?? null;
  const title = name ?? chosen?.name ?? "Untitled form";

  const q = query.trim().toLowerCase();
  const list = all
    .filter((t) => (cat === "All" ? true : cat === "Your templates" ? t.mine : t.topic === cat && !t.mine))
    .filter((t) => (q ? `${t.name} ${t.blurb} ${t.topic}`.toLowerCase().includes(q) : true));
  const tiles = [
    ...(cat === "All" && !q
      ? [{ slug: "blank", name: "Blank form", note: "Start with one question", icon: "plus", accent: "var(--neutral-100)" }]
      : []),
    ...list.map((t) => ({
      slug: t.slug,
      name: t.name,
      note: `${t.questions} ${t.questions === 1 ? "question" : "questions"}`,
      icon: t.icon,
      accent: t.accent,
    })),
  ];

  async function go() {
    setBusy(true);
    try {
      const formId = await create({
        title: title.trim() || undefined,
        templateSlug: pick === "blank" ? undefined : pick,
      });
      toast("Form created", { detail: chosen ? `From ${chosen.name}` : title });
      onClose();
      router.push(`/app/forms/${formId}`);
    } catch (e) {
      setBusy(false);
      toast("Formkit could not create the form", {
        detail: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  }

  const cats = ["All", ...(mine.length ? ["Your templates"] : []), ...TEMPLATE_TOPICS];

  return (
    <Modal
      title="Create a form"
      description="Start from scratch, or from something that already works."
      onClose={onClose}
      width={760}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} disabled={busy} iconRight={<ArrowRight size={16} strokeWidth={1.8} aria-hidden />}>
            {busy ? "Creating…" : pick === "blank" ? "Create blank form" : "Use this template"}
          </Button>
        </>
      }
    >
      <div className="fk-create-top">
        <Field label="Form name">
          <Input
            value={title}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void go();
            }}
            autoFocus
          />
        </Field>
        <Field label="Find a template">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            icon={<Search size={17} strokeWidth={1.8} aria-hidden />}
          />
        </Field>
      </div>

      <div className="fk-create-cats">
        {cats.map((c) => (
          <button key={c} type="button" className="fk-filter" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
        <span className="fk-create-count">
          {list.length} {list.length === 1 ? "template" : "templates"}
        </span>
      </div>

      <div className="fk-create-tiles" role="radiogroup" aria-label="Start from">
        {tiles.map((t) => (
          <button
            key={t.slug}
            type="button"
            role="radio"
            aria-checked={pick === t.slug}
            className="fk-create-tile"
            onClick={() => {
              setPick(t.slug);
              setName(null);
            }}
            onDoubleClick={() => void go()}
          >
            <span className="fk-create-plate" style={{ background: t.accent }}>
              <TemplateIcon name={t.icon} size={22} />
              {pick === t.slug && (
                <span className="fk-create-check">
                  <Check size={14} strokeWidth={2.2} aria-hidden />
                </span>
              )}
            </span>
            <span style={{ display: "block", padding: "0 2px" }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 500, lineHeight: 1.3 }}>{t.name}</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--color-text-tertiary)", marginTop: 2 }}>
                {t.note}
              </span>
            </span>
          </button>
        ))}
      </div>

      {templates && list.length === 0 && (
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--color-text-tertiary)" }}>
          No templates match “{query}”. Try another word, or start from a blank form.
        </p>
      )}
    </Modal>
  );
}
