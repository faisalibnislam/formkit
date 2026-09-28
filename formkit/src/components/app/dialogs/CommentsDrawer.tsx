"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Check, Send, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Badge, Button, Drawer, IconButton, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { relativeTime as ago } from "../bits";
import { MentionField, mentionsIn, withMentions } from "./MentionField";

/**
 * Comments, in a drawer: every thread on the form, or only those on one
 * question. Replying to a resolved thread reopens it.
 */
export function CommentsDrawer({
  formId,
  blockId,
  onScope,
  onClose,
}: {
  formId: Id<"forms">;
  /** Only this question's threads; null for all of them. */
  blockId: string | null;
  onScope: (blockId: string | null) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const form = useQuery(api.forms.get, { formId });
  const data = useQuery(api.comments.list, { formId });
  const add = useMutation(api.comments.add);
  const resolve = useMutation(api.comments.resolve);
  const remove = useMutation(api.comments.remove);
  const people = useQuery(api.comments.mentionable, { formId }) ?? [];
  const readFor = useMutation(api.inbox.readFor);

  // Opening the comments counts as reading their notices.
  const readForRef = useRef(readFor);
  useEffect(() => {
    readForRef.current = readFor;
  });
  useEffect(() => {
    void readForRef.current({ formId, kinds: ["comment", "reply", "mention", "resolved"] }).catch(() => {});
  }, [formId]);

  const [draft, setDraft] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);

  const questions = (form?.blocks ?? []).filter((b) => b.kind === "field");
  const numberOf = (id: string | null) => {
    const i = questions.findIndex((q) => q._id === id);
    return i < 0 ? null : i + 1;
  };
  const label = (id: string | null) => {
    if (!id) return "the whole form";
    const n = numberOf(id);
    const q = questions.find((x) => x._id === id);
    return n ? `question ${String(n).padStart(2, "0")}` : (q?.title ?? "a question");
  };

  const all = data?.threads ?? [];
  const scoped = blockId ? all.filter((t) => t.blockId === blockId) : all;
  const resolved = scoped.filter((t) => t.resolved);
  const shown = scoped.filter((t) => showResolved || !t.resolved);
  const question = blockId ? questions.find((q) => q._id === blockId) : null;

  async function run<T>(work: Promise<T>, fail: string) {
    try {
      return await work;
    } catch (e) {
      toast(fail, { detail: e instanceof Error ? e.message : undefined, tone: "error" });
      return null;
    }
  }

  return (
    <Drawer title={blockId ? `Comments on ${label(blockId)}` : "All comments"} onClose={onClose}>
      {blockId && (
        <>
          <Button
            variant="ghost"
            size="sm"
            style={{ marginBottom: 14, paddingLeft: 6 }}
            iconLeft={<ArrowLeft size={15} strokeWidth={1.8} aria-hidden />}
            onClick={() => onScope(null)}
          >
            All comments
          </Button>
          <div className="fk-comment-q">{question?.title || "Untitled question"}</div>
        </>
      )}

      {data && shown.length === 0 && (
        <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.6, color: "var(--color-text-tertiary)" }}>
          No open comments. Leave one and anyone with access to this form will see it here.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {shown.map((c) => (
          <div key={c._id} className="fk-thread" data-resolved={c.resolved ? "true" : undefined}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <span className="fk-thread-avatar" style={{ background: c.color }}>
                {initials(c.author)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 500 }}>{c.author}</span>
                  <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>{ago(c.createdAt)}</span>
                </div>
                {!blockId && (
                  <button type="button" className="fk-thread-where" onClick={() => onScope(c.blockId)}>
                    {c.blockId ? `On ${label(c.blockId)}` : "On the whole form"}
                  </button>
                )}
              </div>
              {c.resolved && (
                <Badge tone="success">
                  <Check size={12} strokeWidth={2} aria-hidden /> Resolved
                </Badge>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {withMentions(c.body, c.mentions)}
            </p>

            {c.replies.length > 0 && (
              <div className="fk-thread-replies">
                {c.replies.map((r) => (
                  <div key={r._id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                      <span className="fk-thread-avatar" data-size="sm" style={{ background: r.color }}>
                        {initials(r.author)}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{r.author}</span>
                      <span style={{ fontSize: 12.5, color: "var(--color-text-tertiary)" }}>{ago(r.createdAt)}</span>
                      {r.canDelete && (
                        <IconButton
                          label="Delete reply"
                          style={{ marginLeft: "auto", width: 28, height: 28 }}
                          onClick={() => run(remove({ commentId: r._id as Id<"comments"> }), "That reply was not deleted")}
                        >
                          <Trash2 size={13} strokeWidth={1.8} aria-hidden />
                        </IconButton>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {withMentions(r.body, r.mentions)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {data?.canComment && (
              <form
                style={{ display: "flex", gap: 8, marginTop: 14 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const body = (replies[c._id] ?? "").trim();
                  if (!body) return;
                  const ok = await run(
                    add({
                      formId,
                      body,
                      parentId: c._id as Id<"comments">,
                      mentions: mentionsIn(body, people) as Id<"users">[],
                    }),
                    "That reply did not go",
                  );
                  if (ok) setReplies((r) => ({ ...r, [c._id]: "" }));
                }}
              >
                <MentionField
                  placeholder="Reply, or type @ to mention someone"
                  label="Reply"
                  people={people}
                  value={replies[c._id] ?? ""}
                  onChange={(next) => setReplies((r) => ({ ...r, [c._id]: next }))}
                />
                <IconButton label="Send reply" type="submit">
                  <Send size={15} strokeWidth={1.8} aria-hidden />
                </IconButton>
              </form>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {data?.canComment && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<Check size={15} strokeWidth={1.8} aria-hidden />}
                  onClick={async () => {
                    const ok = await run(
                      resolve({ commentId: c._id as Id<"comments">, resolved: !c.resolved }),
                      "That did not change",
                    );
                    if (ok !== null) toast(c.resolved ? "Reopened" : "Resolved");
                  }}
                >
                  {c.resolved ? "Reopen" : "Resolve"}
                </Button>
              )}
              {c.canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<Trash2 size={15} strokeWidth={1.8} aria-hidden />}
                  onClick={async () => {
                    const ok = await run(remove({ commentId: c._id as Id<"comments"> }), "That comment was not deleted");
                    if (ok !== null) toast("Comment deleted");
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {resolved.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <Switch checked={showResolved} label="Show resolved comments" onChange={setShowResolved} />
          <span style={{ fontSize: 14, color: "var(--color-text-tertiary)" }}>Show {resolved.length} resolved</span>
        </div>
      )}

      {data?.canComment ? (
        <form
          className="fk-comment-compose"
          onSubmit={async (e) => {
            e.preventDefault();
            const body = draft.trim();
            if (!body) return;
            const mentioned = mentionsIn(body, people);
            const ok = await run(
              add({
                formId,
                body,
                blockId: (blockId ?? undefined) as Id<"blocks"> | undefined,
                mentions: mentioned as Id<"users">[],
              }),
              "That comment did not go",
            );
            if (ok) {
              setDraft("");
              const names = people.filter((p) => mentioned.includes(p._id)).map((p) => p.name);
              toast("Comment added", {
                detail: names.length ? `${names.join(", ")} will be told` : `On ${label(blockId)}`,
              });
            }
          }}
        >
          <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Commenting on {label(blockId)}</div>
          <MentionField
            multiline
            placeholder="Add a comment. Type @ to mention someone"
            label="Add a comment"
            people={people}
            value={draft}
            onChange={setDraft}
            onSubmitShortcut={() => document.querySelector<HTMLFormElement>(".fk-comment-compose")?.requestSubmit()}
          />
          <div>
            <Button type="submit" size="sm" disabled={!draft.trim()} iconLeft={<Send size={15} strokeWidth={1.8} aria-hidden />}>
              Comment
            </Button>
          </div>
        </form>
      ) : (
        data && (
          <p style={{ marginTop: 22, fontSize: 13.5, color: "var(--color-text-tertiary)" }}>
            You are a Viewer on this form, so you can read comments but not write them.
          </p>
        )
      )}
    </Drawer>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
