"use client";

import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, EyeOff, History, Rocket, Undo2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { StatDot } from "../ds";
import { tracked } from "../editor/saveStatus";

/**
 * Publishing, with a quick check first. A live form retitles the dialog, says
 * how many questions have changed since the live version, and swaps its
 * footer to Done / Unpublish / Publish changes.
 *
 * Unpublishing takes the form back to a draft and keeps every response.
 * Closing is a separate thing, and has its own dialog.
 */
export function PublishDialog({
  formId,
  onClose,
  onVersions,
  onPublished,
}: {
  formId: Id<"forms">;
  onClose: () => void;
  onVersions: () => void;
  /** After a first publish — the share panel is the natural next step. */
  onPublished?: () => void;
}) {
  const toast = useToast();
  const form = useQuery(api.forms.get, { formId });
  const pending = useQuery(api.forms.unpublishedChanges, { formId }) ?? 0;
  const publish = useMutation(api.forms.publish);
  const unpublish = useMutation(api.forms.unpublish);
  const request = useMutation(api.approvals.request);
  const withdraw = useMutation(api.approvals.withdraw);
  const approve = useMutation(api.approvals.approve);
  const decline = useMutation(api.approvals.decline);
  const [note, setNote] = useState("");

  if (!form) return null;
  const live = form.status !== "draft";
  const fields = form.blocks.filter((b) => b.kind === "field");
  const unlabelled = fields.filter((f) => f.required && !f.title?.trim()).length;
  const emptyChoices = fields.filter(
    (f) => ["single-choice", "multi-choice", "dropdown"].includes(f.type ?? "") && !f.options?.some((o) => o.trim()),
  ).length;
  const confirmWithoutEmail =
    !!(form.notify as { confirm?: boolean } | null)?.confirm && !fields.some((f) => f.type === "email");

  const checks = [
    {
      ok: fields.length > 0,
      label: "Form has questions",
      detail: fields.length === 1 ? "1 question" : `${fields.length} questions`,
    },
    { ok: !!form.title.trim(), label: "Form has a title", detail: form.title || "Give it a name in the header" },
    {
      ok: !!form.thanks?.message?.trim(),
      label: "Thank-you screen configured",
      detail: form.thanks?.message?.trim()
        ? form.thanks.title || "Thank you"
        : "Write a line for people to read after they submit",
    },
    {
      ok: unlabelled === 0,
      label: "No required fields are incomplete",
      detail: unlabelled
        ? `${unlabelled} required question${unlabelled === 1 ? " has" : "s have"} no label`
        : "Every required question has a label",
    },
    ...(emptyChoices
      ? [
          {
            ok: false,
            label: "Every choice question has options",
            detail: `${emptyChoices} question${emptyChoices === 1 ? " offers" : "s offer"} nothing to pick`,
          },
        ]
      : []),
    ...(confirmWithoutEmail
      ? [
          {
            ok: false,
            label: "Confirmation email has somewhere to go",
            detail: "It is switched on, but the form has no email question",
          },
        ]
      : []),
  ];

  const changesNote =
    pending === 1
      ? `One question has changed since version ${form.liveVersion ?? 1}.`
      : `${pending} questions have changed since version ${form.liveVersion ?? 1}.`;

  const approval = form.approval;
  // Business approvals: an editor asks; the owner or an admin approves.
  const mustAsk = !!approval?.required;
  const waiting = approval?.state === "pending";
  const reviewing = waiting && !!approval?.canApprove;

  async function doPublish(first: boolean) {
    if (mustAsk) {
      await tracked(request({ formId, note: note || undefined }));
      toast("Sent for approval", { detail: "You will hear when it is approved." });
      onClose();
      return;
    }
    await tracked(publish({ formId }));
    toast(first ? "Your form is live" : "Changes are live", { detail: form!.url });
    onClose();
    if (first) onPublished?.();
  }

  return (
    <Modal
      title={live ? "This form is published" : "Ready to publish?"}
      description={
        live
          ? "Anyone with the link can answer it. Unpublish to take it back to a draft."
          : "A quick check before anyone can answer it."
      }
      onClose={onClose}
      width={580}
      footer={
        reviewing ? (
          <>
            <Button
              variant="secondary"
              iconLeft={<Undo2 size={16} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                await tracked(decline({ formId, note: note || undefined }));
                toast("Sent back", { detail: `${approval?.by ?? "They"} will see your note.` });
                onClose();
              }}
            >
              Send back
            </Button>
            <Button
              iconLeft={<BadgeCheck size={16} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                await tracked(approve({ formId }));
                toast("Approved and live", { detail: form.url });
                onClose();
              }}
            >
              Approve and publish
            </Button>
          </>
        ) : waiting && mustAsk ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await tracked(withdraw({ formId }));
                toast("Request withdrawn");
                onClose();
              }}
            >
              Withdraw request
            </Button>
          </>
        ) : live ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
            <Button
              variant="secondary"
              iconLeft={<EyeOff size={16} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                await tracked(unpublish({ formId }));
                toast("Unpublished", { detail: "It is a draft again. Every response is kept." });
                onClose();
              }}
            >
              Unpublish
            </Button>
            {pending > 0 && (
              <Button
                iconLeft={<Rocket size={16} strokeWidth={1.8} aria-hidden />}
                onClick={() => doPublish(false)}
              >
                {mustAsk ? "Ask for approval" : "Publish changes"}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Not yet
            </Button>
            <Button
              iconLeft={<Rocket size={16} strokeWidth={1.8} aria-hidden />}
              disabled={fields.length === 0}
              onClick={() => doPublish(true)}
            >
              {mustAsk ? "Ask for approval" : "Publish form"}
            </Button>
          </>
        )
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {approval && (reviewing || mustAsk || approval.state === "declined") && (
          <div className="fk-amber" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <span>
              {reviewing
                ? `${approval.by} asked to publish this${approval.note ? `: “${approval.note}”` : "."} Approving puts it live.`
                : waiting
                  ? "Waiting for the owner or a team admin to approve it."
                  : approval.state === "declined"
                    ? `It was sent back${approval.note ? `: “${approval.note}”` : "."} Make the changes, then ask again.`
                    : "Forms on this team are approved before they go live. Asking tells the owner and the admins."}
            </span>
            {(reviewing || (mustAsk && !waiting)) && (
              <textarea
                className="ui-textarea"
                rows={2}
                value={note}
                placeholder={reviewing ? "A note if you send it back (optional)" : "A note for whoever approves it (optional)"}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </div>
        )}
        {live && pending > 0 && (
          <div className="fk-amber">
            <span style={{ flex: 1, minWidth: 200 }}>{changesNote}</span>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<History size={15} strokeWidth={1.8} aria-hidden />}
              onClick={onVersions}
            >
              Version history
            </Button>
          </div>
        )}
        {checks.map((c) => (
          <div key={c.label} className="fk-check">
            <StatDot tone={c.ok ? "success" : "warning"} size={22} label={c.ok ? "Ready" : "Needs attention"} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 500 }}>{c.label}</span>
              <span className="fk-proprow-hint" style={{ display: "block", fontSize: 13.5 }}>
                {c.detail}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
