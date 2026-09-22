"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/** Saving a form as a template keeps its questions, welcome and thanks. */
export function SaveTemplateDialog({
  formId,
  title,
  onClose,
}: {
  formId: Id<"forms">;
  title: string;
  onClose: () => void;
}) {
  const save = useMutation(api.templates.saveFrom);
  const toast = useToast();
  const [name, setName] = useState(title);
  const [blurb, setBlurb] = useState("");

  return (
    <Modal
      title="Save as a template"
      description="It joins your template list, ready to start a new form from."
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await save({ formId, name, blurb });
              toast(`“${name}” is in your templates`);
              onClose();
            }}
            disabled={!name.trim()}
          >
            Save template
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
      </div>
    </Modal>
  );
}
