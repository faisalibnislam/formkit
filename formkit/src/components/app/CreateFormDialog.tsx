"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { FileText, LayoutTemplate } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * Creating a form is two decisions: blank or a template, and what to call it.
 * Which identity it publishes under is decided by the account's defaults and
 * changed later under the form's own settings — it is not asked for here.
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
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const chosen = templates?.find((t) => t.slug === pick) ?? null;

  async function go() {
    setBusy(true);
    try {
      const formId = await create({
        title: title.trim() || undefined,
        templateSlug: pick === "blank" ? undefined : pick,
      });
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

  return (
    <Modal
      title="Create a form"
      description="Start blank, or lift one of the templates and change what you like."
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} disabled={busy}>
            {busy ? "Creating…" : "Create form"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Start from">
          <Select
            value={pick}
            onChange={setPick}
            ariaLabel="Start from"
            options={[
              { value: "blank", label: "A blank form", note: "One question, then it is yours" },
              ...(templates ?? []).map((t) => ({
                value: t.slug,
                label: t.name,
                note: `${t.questions} questions · ${t.pages} ${t.pages === 1 ? "page" : "pages"}`,
              })),
            ]}
          />
        </Field>

        <div className="fk-note" data-tone="info">
          {pick === "blank" ? (
            <FileText size={16} strokeWidth={1.8} aria-hidden />
          ) : (
            <LayoutTemplate size={16} strokeWidth={1.8} aria-hidden />
          )}
          <span>
            {chosen
              ? chosen.blurb
              : "A blank form starts with one short-text question. Add the rest from the field library."}
          </span>
        </div>

        <Field label="Name it" help="Only you see this. The public link uses it too, and you can change both later.">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={chosen ? chosen.name : "Untitled form"}
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  );
}
