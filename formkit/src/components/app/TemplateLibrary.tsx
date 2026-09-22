"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge, Button, EmptyState, IconButton } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { CreateFormDialog } from "./CreateFormDialog";

/** The template library: the six Formkit ships with, plus anything saved. */
export function TemplateLibrary() {
  const toast = useToast();
  const templates = useQuery(api.templates.list, {});
  const remove = useMutation(api.templates.remove);
  const [pick, setPick] = useState<string | null>(null);

  if (!templates) return null;

  return (
    <>
      <div className="fk-grid" data-cols="cards">
        {templates.map((t) => (
          <section key={t.slug} className="fk-panel">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Badge tone={t.mine ? "info" : "neutral"}>{t.topic}</Badge>
              {t.mine && t._id && (
                <>
                  <span className="fk-toolbar-spacer" />
                  <IconButton
                    label={`Delete ${t.name}`}
                    tone="danger"
                    onClick={async () => {
                      await remove({ templateId: t._id! });
                      toast(`“${t.name}” deleted`);
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                </>
              )}
            </div>
            <h3>{t.name}</h3>
            <p className="fk-panel-lede">{t.blurb}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Button size="sm" onClick={() => setPick(t.slug)}>
                Use this template
              </Button>
              <span style={{ fontSize: 13.5, color: "var(--color-text-tertiary)" }}>
                {t.questions} questions · {t.pages} {t.pages === 1 ? "page" : "pages"}
              </span>
            </div>
          </section>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="fk-panel">
          <EmptyState title="No templates" description="Save a form as a template and it appears here." />
        </div>
      )}

      {pick && <CreateFormDialog initialTemplate={pick} onClose={() => setPick(null)} />}
    </>
  );
}
