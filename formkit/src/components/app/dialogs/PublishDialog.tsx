"use client";

import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, EyeOff, History, Rocket, Undo2 } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { StatDot } from "../ds";
import { FormLinks, OwnerSummary } from "../editor/PublishedUnder";
import { tracked } from "../editor/saveStatus";

/**
 * Publishing, with a quick check first. A live form retitles the dialog, says
 * how many questions have changed since the live version, and swaps its
 * footer to Done / Unpublish / Publish changes.
 *
 * Both states lead with who the form belongs to and its links. Unpublishing
 * asks first: it takes the form back to a draft, keeps every response, and
 * kills the link (a 404, or the owner's own domain home). Closing is a
 * separate thing, and has its own dialog.
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
  /** After a first publish - the share panel is the natural next step. */
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
  const [confirming, setConfirming] = useState(false);

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
      title={confirming ? "Unpublish this form?" : live ? "This form is published" : "Ready to publish?"}
      description={
        confirming
          ? "It goes back to being a draft."
          : live
            ? "Anyone with the link can answer it."
            : "Check who it belongs to, where it will live, and a few basics."
      }
      onClose={onClose}
      width={580}
      footer={
        confirming ? (
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep it live
            </Button>
            <Button
              variant="destructive"
              iconLeft={<EyeOff size={16} strokeWidth={1.8} aria-hidden />}
              onClick={async () => {
                await tracked(unpublish({ formId }));
                toast("Unpublished", { detail: "The link is off. Every response is kept." });
                onClose();
              }}
            >
              Unpublish
            </Button>
          </>
        ) : reviewing ? (
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
              onClick={() => setConfirming(true)}
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
      {confirming ? (
        <div className="fk-pubcard">
          <FormLinks form={form} live={false} label="Stops working" alsoLabel="Also stops" />
          <ul className="fk-pubgone">
            <li>
              Anyone who opens the link{form.links.formkit ? "s" : ""}{" "}
              {form.links.formkit
                ? `is sent to the home page of ${form.links.primary.split("/")[0]}, which lists the forms still open there.`
                : "gets a “page not found” page."}
            </li>
            <li>Embeds stop showing the form too.</li>
            <li>Every response, and the form itself, is kept. Publish again and the same link comes back.</li>
          </ul>
        </div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="fk-pubcard">
          <OwnerSummary
            form={form}
            action={
              form.mine ? (
                <Link
                  href={`/app/forms/${formId}?tab=settings`}
                  className="ui-btn"
                  data-variant="ghost"
                  data-size="sm"
                  onClick={onClose}
                >
                  Change
                </Link>
              ) : undefined
            }
          />
          <FormLinks form={form} live={live && form.status !== "archived"} />
        </div>
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
      )}
    </Modal>
  );
}
