"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Inbox, Link2, Lock, Unlock } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Field, Modal, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ClosingRules, closeWhenLabel } from "../editor/ClosingRules";
import { tracked } from "../editor/saveStatus";
import { localZone } from "../time";

const DEFAULT_NOTE = "This form is closed. Thank you to everyone who answered.";

/**
 * Closing stops a form taking answers and keeps everything already sent. It can
 * close now, or be told when to close itself — on a date, or after so many
 * responses.
 *
 * Reopening switches off a closing rule that has already elapsed, or the form
 * would close again the moment it opened.
 */
export function CloseFormDialog({
  formId,
  status,
  onClose,
  onDone,
}: {
  formId: Id<"forms">;
  status: "draft" | "published" | "closed" | "archived";
  onClose: () => void;
  onDone?: () => void;
}) {
  const form = useQuery(api.forms.get, { formId });
  const setClosing = useMutation(api.forms.setClosing);
  const toast = useToast();
  const [note, setNote] = useState<string | null>(null);
  const reopening = status === "closed";

  const zone = form?.closing?.timezone ?? localZone();
  const message = note ?? form?.closing?.message ?? DEFAULT_NOTE;

  if (reopening) {
    return (
      <Modal
        title={`Reopen ${form?.title ?? "this form"}?`}
        description="It starts taking answers again at the same link."
        onClose={onClose}
        width={500}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              iconLeft={<Unlock size={16} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                await tracked(setClosing({ formId, reopen: true }));
                toast("Form reopened", { detail: "It is collecting responses again" });
                onClose();
                onDone?.();
              }}
            >
              Reopen it
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    );
  }

  const scheduled = !!(form?.closing?.closeAt || form?.closing?.closeAfter);

  return (
    <Modal
      title={`Close ${form?.title ?? "this form"}?`}
      description="Closing stops new answers. Nothing you have already collected is deleted, and you can reopen it whenever you like."
      onClose={onClose}
      width={560}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="fk-facts">
          <span>
            <Inbox size={15} strokeWidth={1.8} aria-hidden />
            <span>
              {(form?.responses ?? 0).toLocaleString("en-US")} responses stay in your inbox, with
              analytics and exports intact.
            </span>
          </span>
          <span>
            <Link2 size={15} strokeWidth={1.8} aria-hidden />
            <span>
              The share link and embed keep working — anyone who opens them sees your closing
              message.
            </span>
          </span>
          <span>
            <Unlock size={15} strokeWidth={1.8} aria-hidden />
            <span>Reopen it from this form&rsquo;s menu, or from the Forms list, at any time.</span>
          </span>
        </div>

        <div className="fk-closenow">
          <span style={{ flex: 1, minWidth: 190 }}>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 500 }}>Close it now</span>
            <span className="fk-proprow-hint" style={{ display: "block" }}>
              Stops new answers immediately.
            </span>
          </span>
          <Button
            iconLeft={<Lock size={16} strokeWidth={1.8} aria-hidden />}
            onClick={async () => {
              await tracked(
                setClosing({ formId, closeNow: true, closing: { message: message.trim() || DEFAULT_NOTE } }),
              );
              toast("Form closed", { detail: "The link still works — visitors see your closing message" });
              onClose();
              onDone?.();
            }}
          >
            Close now
          </Button>
        </div>

        <div>
          {form && (
            <ClosingRules
              formId={formId}
              closing={form.closing}
              responses={form.responses}
              zone={zone}
              dateHint="It closes itself the moment this passes"
            />
          )}
        </div>

        <Field label="What visitors see instead">
          <Textarea
            rows={2}
            value={message}
            onChange={(e) => setNote(e.target.value)}
            placeholder={DEFAULT_NOTE}
          />
        </Field>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            onClick={async () => {
              if (note !== null) {
                await tracked(setClosing({ formId, closing: { message: note.trim() || DEFAULT_NOTE } }));
              }
              if (scheduled && form) {
                toast("Closing rules saved", {
                  detail: closeWhenLabel(form.closing, form.responses, zone),
                });
              }
              onClose();
            }}
          >
            {scheduled ? "Save closing rules" : "Done"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
