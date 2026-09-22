"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Field, Modal, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";

/**
 * Closing stops a form taking answers and keeps everything already sent.
 *
 * Reopening switches off a closing rule that has already elapsed — otherwise
 * the form would close again the moment it opened.
 */
export function CloseFormDialog({
  formId,
  status,
  onClose,
  onDone,
}: {
  formId: Id<"forms">;
  status: "draft" | "published" | "closed";
  onClose: () => void;
  onDone?: () => void;
}) {
  const setClosing = useMutation(api.forms.setClosing);
  const toast = useToast();
  const [message, setMessage] = useState("");
  const reopening = status === "closed";

  return (
    <Modal
      title={reopening ? "Reopen this form" : "Close this form"}
      description={
        reopening
          ? "It starts taking answers again at the same link."
          : "Nobody can answer it after this. Everything already sent to you is kept."
      }
      onClose={onClose}
      width={500}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={reopening ? "primary" : "destructive"}
            onClick={async () => {
              await setClosing({
                formId,
                ...(reopening
                  ? { reopen: true }
                  : { closeNow: true, closing: message.trim() ? { message: message.trim() } : undefined }),
              });
              toast(reopening ? "Collecting again" : "The form is closed");
              onClose();
              onDone?.();
            }}
          >
            {reopening ? "Reopen it" : "Close it"}
          </Button>
        </>
      }
    >
      {!reopening && (
        <Field
          label="What visitors see when they arrive"
          help="Leave it blank and Formkit says the form is closed and thanks them."
        >
          <Textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="This form is closed. Thank you to everyone who answered."
          />
        </Field>
      )}
    </Modal>
  );
}
