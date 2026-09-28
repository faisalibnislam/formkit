"use client";

import { useSeededQuery } from "@/lib/seed";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Bookmark, Copy, Eye, FileText, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button, Drawer, EmptyState, IconButton, Input, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { CreateFormDialog } from "./CreateFormDialog";
import { SaveTemplateDialog, TEMPLATE_TOPICS } from "./dialogs/SaveTemplateDialog";
import { FieldIcon } from "./editor/FieldIcon";
import { fieldType } from "./editor/fieldTypes";
import { TemplateIcon } from "./TemplateIcon";
import { PageSkeleton } from "./Skeleton";
import { openUpgrade, upgradeOnPlanError, useGate } from "@/components/plan/usePlan";

/**
 * The template library: the thirteen Formkit ships with, filed by topic, and
 * the person's own saved ones, which can be renamed, copied or deleted. Any
 * template can be previewed question by question before it is used.
 */

type Row = NonNullable<ReturnType<typeof useTemplates>>[number];

function useTemplates() {
  return useSeededQuery(api.templates.list, {});
}

export function TemplateLibrary() {
  const toast = useToast();
  const templates = useTemplates();
  const forms = useSeededQuery(api.forms.list, { filter: "all" });
  const remove = useMutation(api.templates.remove);
  const duplicate = useMutation(api.templates.duplicate);
  const setShared = useMutation(api.templates.setShared);
  const teamGate = useGate("templates.shared");

  const [term, setTerm] = useState("");
  const [topic, setTopic] = useState("All");
  const [pick, setPick] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  if (!templates) return <PageSkeleton kind="cards" />;

  const needle = term.trim().toLowerCase();
  // Templates shared on a team sit with the person's own, marked as the team's.
  const builtin = templates.filter((t) => !t.mine && !t.team);
  const mine = templates.filter((t) => t.mine || t.team);
  const shown = builtin
    .filter((t) => (topic === "All" ? true : t.topic === topic))
    .filter((t) => (needle ? `${t.name} ${t.blurb} ${t.topic}`.toLowerCase().includes(needle) : true));
  const mineShown = mine.filter((t) =>
    needle ? `${t.name} ${t.blurb} ${t.topic}`.toLowerCase().includes(needle) : true,
  );
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
          wrapStyle={{ width: 280 }}
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
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Your templates</h3>
          <span className="fk-proprow-hint">{mine.length ? `${mine.length} saved` : "None yet"}</span>
        </div>
        <p className="fk-panel-lede" style={{ marginBottom: 18 }}>
          {mine.length
            ? "Forms you saved to start from again. Each keeps what you chose when you saved it."
            : "Anything you save from one of your forms lands here."}
        </p>

        {mine.length === 0 ? (
          <div className="fk-hint-row">
            <span className="fk-hint-mark" aria-hidden>
              <Bookmark size={18} strokeWidth={1.8} />
            </span>
            <p>
              Build a form the way you like it, then save it here — open the form, then choose Save as
              template from its menu.
            </p>
            {firstForm && (
              <Link href={`/app/forms/${firstForm._id}`}>
                <Button variant="secondary" iconLeft={<FileText size={16} strokeWidth={1.8} aria-hidden />}>
                  Open a form
                </Button>
              </Link>
            )}
          </div>
        ) : mineShown.length === 0 ? (
          <p className="fk-proprow-hint" style={{ margin: 0, fontSize: 14 }}>
            None of your templates match “{term}”.
          </p>
        ) : (
          <div className="fk-mytemplates">
            {mineShown.map((t) => (
              <div key={t.slug} className="fk-mytemplate">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span className="fk-mytemplate-mark">
                    <Bookmark size={17} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15.5, fontWeight: 500, letterSpacing: "-.01em" }}>
                      {t.name}
                    </span>
                    <span className="fk-proprow-hint" style={{ display: "block" }}>
                      {t.team ? `From ${t.team}’s team · ` : t.shared ? "Shared with your team · " : ""}
                      {t.topic} · {t.questions} {t.questions === 1 ? "question" : "questions"}
                    </span>
                  </span>
                  {t.mine && (
                  <span style={{ display: "flex", gap: 2, flex: "0 0 auto" }}>
                  <IconButton
                    tip
                    label={t.shared ? "Stop sharing with the team" : "Share with the team"}
                    onClick={async () => {
                      if (!t.shared && teamGate.locked) {
                        openUpgrade({ feature: "templates.shared" });
                        return;
                      }
                      try {
                        await setShared({ templateId: t._id as Id<"templates">, shared: !t.shared });
                        toast(t.shared ? "No longer shared" : "Shared with your team", {
                          detail: t.shared ? undefined : "Everyone on your team can start from it.",
                        });
                      } catch (e) {
                        upgradeOnPlanError(e);
                      }
                    }}
                  >
                    <Users size={15} strokeWidth={1.8} aria-hidden style={t.shared ? { color: "var(--green-600)" } : undefined} />
                  </IconButton>
                  <IconButton tip label="Edit" onClick={() => setEditing(t)}>
                    <Pencil size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                  <IconButton
                    tip
                    label="Copy"
                    onClick={async () => {
                      await duplicate({ templateId: t._id as Id<"templates"> });
                      toast("Template copied", { detail: `${t.name} (copy)` });
                    }}
                  >
                    <Copy size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                  <IconButton tip label="Delete" tone="danger" onClick={() => setDeleting(t)}>
                    <Trash2 size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                  </span>
                  )}
                </div>
                <p className="fk-proprow-hint" style={{ margin: 0, fontSize: 13.5 }}>
                  {t.blurb}
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(t.keeps ?? []).map((k) => (
                    <span key={k} className="fk-keep">
                      {k}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Button size="sm" iconLeft={<ArrowRight size={15} strokeWidth={1.8} aria-hidden />} onClick={() => setPick(t.slug)}>
                    Use template
                  </Button>
                  <Button variant="ghost" size="sm" iconLeft={<Eye size={15} strokeWidth={1.8} aria-hidden />} onClick={() => setPreview(t.slug)}>
                    Preview
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="fk-filters" role="group" aria-label="Which templates">
        {["All", ...TEMPLATE_TOPICS].map((t) => (
          <button key={t} type="button" className="fk-filter" aria-pressed={topic === t} onClick={() => setTopic(t)}>
            {t}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="fk-panel">
          <EmptyState title="No templates match that." description="Try another word, or browse every category." />
        </div>
      ) : (
        <div className="fk-grid" data-cols="cards">
          {shown.map((t) => (
            <article key={t.slug} className="fk-template">
              <div className="fk-template-plate" style={{ background: t.accent }} aria-hidden>
                <TemplateIcon name={t.icon} size={30} />
              </div>
              <div className="fk-template-body">
                <div className="fk-template-head">
                  <h3>{t.name}</h3>
                </div>
                <p>{t.blurb}</p>
                <div className="fk-template-foot">
                  <span>{t.topic}</span>
                  <span>·</span>
                  <span>
                    {t.questions} {t.questions === 1 ? "question" : "questions"}
                  </span>
                  <span>·</span>
                  <span>
                    {t.pages} {t.pages === 1 ? "page" : "pages"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" size="sm" iconLeft={<Eye size={15} strokeWidth={1.8} aria-hidden />} onClick={() => setPreview(t.slug)}>
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    style={{ flex: 1 }}
                    iconLeft={<ArrowRight size={15} strokeWidth={1.8} aria-hidden />}
                    onClick={() => setPick(t.slug)}
                  >
                    Use template
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {pick !== null && <CreateFormDialog initialTemplate={pick || undefined} onClose={() => setPick(null)} />}
      {preview && (
        <TemplatePreview
          slug={preview}
          onClose={() => setPreview(null)}
          onUse={() => {
            setPick(preview);
            setPreview(null);
          }}
        />
      )}
      {editing && (
        <SaveTemplateDialog
          template={{
            _id: editing._id as Id<"templates">,
            name: editing.name,
            blurb: editing.blurb,
            topic: editing.topic,
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <Modal
          title={`Delete ${deleting.name}?`}
          description="Forms you already made from it are not touched. The template itself cannot be brought back."
          onClose={() => setDeleting(null)}
          width={460}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                iconLeft={<Trash2 size={16} strokeWidth={1.8} aria-hidden />}
                onClick={async () => {
                  const t = deleting;
                  setDeleting(null);
                  await remove({ templateId: t._id as Id<"templates"> });
                  toast("Template deleted", { detail: t.name });
                }}
              >
                Delete template
              </Button>
            </>
          }
        >
          {null}
        </Modal>
      )}
    </>
  );
}

function TemplatePreview({ slug, onClose, onUse }: { slug: string; onClose: () => void; onUse: () => void }) {
  const t = useQuery(api.templates.get, { slug });
  let n = 0;
  return (
    <Drawer
      title={t?.name ?? "Template"}
      onClose={onClose}
      footer={
        <Button fullWidth iconLeft={<ArrowRight size={16} strokeWidth={1.8} aria-hidden />} onClick={onUse}>
          Use this template
        </Button>
      }
    >
      {t && (
        <>
          <p className="fk-proprow-hint" style={{ margin: "0 0 18px", fontSize: 14 }}>
            {t.blurb}
          </p>
          {t.welcome && (
            <div className="fk-comment-q">
              <div style={{ fontWeight: 500 }}>{t.welcome.title}</div>
              <div className="fk-proprow-hint" style={{ margin: "4px 0 0" }}>
                {t.welcome.message}
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {t.blocks.map((b, i) =>
              b.kind === "pagebreak" ? (
                <div key={i} className="fk-tplpreview-page">
                  {b.title || "New page"}
                </div>
              ) : (
                <div key={i} className="fk-tplpreview-q">
                  <span className="fk-tplpreview-no">{String(++n).padStart(2, "0")}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14.5 }}>
                      {b.title}
                      {b.required && <span className="fk-qcard-required">*</span>}
                    </span>
                    <span className="fk-proprow-hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <FieldIcon name={fieldType(b.type).icon} size={13} />
                      {fieldType(b.type).label}
                      {b.options?.length ? ` · ${b.options.length} options` : ""}
                    </span>
                  </span>
                </div>
              ),
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
