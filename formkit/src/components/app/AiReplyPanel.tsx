"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { AlertTriangle, Mail, Pencil, RefreshCw, Send, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { upgradeOnPlanError } from "@/components/plan/usePlan";
import { errorText } from "./settings/bits";
import { InsightChips } from "./editor/AiReplySection";
import { fullTime } from "./bits";

type Reply = {
  status: "pending" | "ready" | "failed" | "skipped";
  subject: string | null;
  text: string | null;
  reason: string | null;
  at: number | null;
  emailedAt: number | null;
  emailState: string | null;
  rating: "up" | "down" | null;
  needsHuman: boolean;
  edited: boolean;
};
type Insight = {
  sentiment: "positive" | "neutral" | "negative";
  intent?: string;
  topics: string[];
  score?: number;
  urgency?: "low" | "medium" | "high";
  summary?: string;
};

/**
 * Business: in a response, the reply the AI wrote for this person - what it
 * said, whether it was emailed, how they rated it - with edit, resend and
 * write-again; and above it, what the AI read in the response.
 */
export function AiReplyPanel({
  responseId,
  reply,
  insight,
  hasEmail,
}: {
  responseId: Id<"responses">;
  reply: Reply | null;
  insight: Insight | null;
  hasEmail: boolean;
}) {
  const toast = useToast();
  const edit = useMutation(api.aiReply.edit);
  const retry = useMutation(api.aiReply.retry);
  const resend = useAction(api.aiReply.resend);
  const [editing, setEditing] = useState<{ subject: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!reply && !insight) return null;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That didn’t work."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fk-resp-ai">
      {insight && (
        <div className="fk-resp-ai-block">
          <div className="fk-resp-group-title">What the AI read</div>
          <InsightChips insight={insight} />
        </div>
      )}
      {reply && (
        <div className="fk-resp-ai-block">
          <div className="fk-resp-group-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={14} strokeWidth={1.8} aria-hidden style={{ display: "inline-block" }} />
            AI reply
            {reply.edited && <span className="fk-insight-chip">edited</span>}
          </div>
          {reply.status === "pending" && <p className="fk-resp-ai-note">Being written…</p>}
          {reply.status === "skipped" && (
            <p className="fk-resp-ai-note">
              Not written: {reply.reason === "allowance" ? "the month’s AI replies had run out, so they got your usual confirmation." : (reply.reason ?? "it was skipped.")}
            </p>
          )}
          {reply.status === "failed" && (
            <p className="fk-resp-ai-note">
              The AI couldn’t write this one{reply.reason ? ` (${reply.reason})` : ""}. They got your usual confirmation instead.
            </p>
          )}
          {reply.status === "ready" && !editing && (
            <div className="fk-aireply-letter">
              {reply.subject && <div className="fk-aireply-subject">{reply.subject}</div>}
              <div className="fk-aireply-body">{reply.text}</div>
            </div>
          )}
          {editing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Input
                inputSize="sm"
                aria-label="Subject"
                value={editing.subject}
                onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
              />
              <Textarea
                rows={8}
                aria-label="Reply"
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
              />
            </div>
          )}
          {reply.status === "ready" && (
            <div className="fk-resp-ai-meta">
              {reply.needsHuman && (
                <span className="fk-aireply-flag">
                  <AlertTriangle size={14} strokeWidth={1.8} aria-hidden /> Worth a personal follow-up
                </span>
              )}
              {reply.emailedAt ? (
                <span>
                  <Mail size={13} strokeWidth={1.8} aria-hidden style={{ display: "inline-block", marginRight: 5 }} />
                  Emailed {fullTime(reply.emailedAt)}
                </span>
              ) : reply.emailState && reply.emailState !== "sent" ? (
                <span>Not emailed{reply.emailState === "no-address" ? ", no email address" : ""}</span>
              ) : null}
              {reply.rating && (
                <span>
                  {reply.rating === "up" ? (
                    <ThumbsUp size={13} strokeWidth={1.8} aria-hidden style={{ display: "inline-block", marginRight: 5 }} />
                  ) : (
                    <ThumbsDown size={13} strokeWidth={1.8} aria-hidden style={{ display: "inline-block", marginRight: 5 }} />
                  )}
                  They found it {reply.rating === "up" ? "helpful" : "unhelpful"}
                </span>
              )}
            </div>
          )}
          <div className="fk-resp-ai-actions">
            {reply.status === "ready" &&
              (editing ? (
                <>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await edit({ responseId, subject: editing.subject, text: editing.text });
                        setEditing(null);
                      }, "Reply saved")
                    }
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconLeft={<Pencil size={14} strokeWidth={1.8} aria-hidden />}
                    onClick={() => setEditing({ subject: reply.subject ?? "", text: reply.text ?? "" })}
                  >
                    Edit
                  </Button>
                  {hasEmail && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      iconLeft={<Send size={14} strokeWidth={1.8} aria-hidden />}
                      onClick={() => void run(() => resend({ responseId }), "Reply sent")}
                    >
                      {reply.emailedAt ? "Send again" : "Email it"}
                    </Button>
                  )}
                </>
              ))}
            {(reply.status === "failed" || reply.status === "skipped") && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                iconLeft={<RefreshCw size={14} strokeWidth={1.8} aria-hidden />}
                onClick={() => void run(() => retry({ responseId }), "Writing the reply")}
              >
                Write it now
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
