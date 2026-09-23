"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Bookmark } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Field, Input, Modal, Select, Switch, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/** The topics templates are filed under, here and in the library. */
export const TEMPLATE_TOPICS = ["Business", "Agency", "Marketing", "HR", "Events", "Personal"];

/**
 * Saving a form as a template, or editing one already saved. A new one always
 * keeps the questions and pages; the theme, the logic and the welcome and
 * thank-you copy each go if asked.
 */
export function SaveTemplateDialog({
  formId,
  title,
  description,
  template,
  onClose,
}: {
  formId?: Id<"forms">;
  title?: string;
  description?: string | null;
  /** Editing a saved template rather than making one. */
  template?: { _id: Id<"templates">; name: string; blurb: string; topic: string };
  onClose: () => void;
}) {
  const save = useMutation(api.templates.saveFrom);
  const update = useMutation(api.templates.update);
  const toast = useToast();
  const editing = !!template;

  const [name, setName] = useState(template?.name ?? title ?? "");
  const [blurb, setBlurb] = useState(template?.blurb ?? description ?? (title ? `Saved from ${title}.` : ""));
  const [topic, setTopic] = useState(
    template?.topic && TEMPLATE_TOPICS.includes(template.topic) ? template.topic : "Business",
  );
  const [keepCopy, setKeepCopy] = useState(true);
  const [keepTheme, setKeepTheme] = useState(true);
  const [keepLogic, setKeepLogic] = useState(true);
  const [busy, setBusy] = useState(false);

  async function commit() {
    setBusy(true);
    try {
      if (template) {
        await update({ templateId: template._id, name, blurb, topic });
        toast("Template updated", { detail: name });
      } else if (formId) {
        await save({ formId, name, blurb, topic, keepCopy, keepTheme, keepLogic });
        toast("Saved as a template", { detail: `${name} is under Your templates` });
      }
      onClose();
    } catch (e) {
      toast("That was not saved", { detail: e instanceof Error ? e.message : undefined, tone: "error" });
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit template" : "Save as a template"}
      description={
        editing
          ? "Change how it reads in your list. The questions inside stay as they were saved."
          : "It joins Your templates, ready to start a new form from."
      }
      onClose={onClose}
      width={540}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            iconLeft={<Bookmark size={16} strokeWidth={1.8} aria-hidden />}
            onClick={commit}
            disabled={!name.trim() || busy}
          >
            {editing ? "Save changes" : "Save template"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="What is it for?" help="One line, so you recognise it in six months.">
          <Textarea
            rows={2}
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="The questions we ask every new client before a project starts."
          />
        </Field>
        <Field label="Topic">
          <Select
            ariaLabel="Topic"
            value={topic}
            onChange={setTopic}
            options={TEMPLATE_TOPICS.map((t) => ({ value: t, label: t }))}
          />
        </Field>
        {!editing && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>What it keeps</div>
            <p className="fk-proprow-hint" style={{ margin: "0 0 4px" }}>
              Questions and pages always come along.
            </p>
            <div className="fk-proprow">
              <div style={{ flex: 1, fontSize: 14 }}>The theme</div>
              <Switch checked={keepTheme} label="Keep the theme" onChange={setKeepTheme} />
            </div>
            <div className="fk-proprow">
              <div style={{ flex: 1, fontSize: 14 }}>The logic rules</div>
              <Switch checked={keepLogic} label="Keep the logic rules" onChange={setKeepLogic} />
            </div>
            <div className="fk-proprow">
              <div style={{ flex: 1, fontSize: 14 }}>The welcome and thank-you copy</div>
              <Switch checked={keepCopy} label="Keep the welcome and thank-you copy" onChange={setKeepCopy} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
