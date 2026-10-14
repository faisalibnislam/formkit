"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Send, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { IconButton } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { relativeTime as ago } from "./bits";
import { MentionField, mentionsIn, withMentions } from "./dialogs/MentionField";

/**
 * The team talking about one response, in its drawer: comments with
 * @mentions, which tell the person mentioned. Everyone who can read the
 * response reads them; Commenters and up write.
 */
export function ResponseComments({ responseId, formId }: { responseId: Id<"responses">; formId: Id<"forms"> }) {
  const toast = useToast();
  const data = useQuery(api.comments.forResponse, { responseId });
  const people = useQuery(api.comments.mentionable, { formId }) ?? [];
  const add = useMutation(api.comments.add);
  const remove = useMutation(api.comments.remove);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data) return null;
  if (!data.comments.length && !data.canComment) return null;

  async function send() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const mentioned = mentionsIn(body, people);
      await add({ formId, responseId, body, mentions: mentioned as Id<"users">[] });
      setDraft("");
      const names = people.filter((p) => mentioned.includes(p._id)).map((p) => p.name);
      if (names.length) toast("Comment added", { detail: `${names.join(", ")} will be told` });
    } catch (e) {
      toast(e instanceof Error ? e.message : "That comment did not go");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div className="fk-resp-group-title">Comments</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.comments.map((c) => (
          <div key={c._id} style={{ display: "flex", gap: 10 }}>
            <span className="fk-thread-avatar" data-size="sm" style={{ background: c.color }}>
              {c.author.slice(0, 1).toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{c.author}</span>
                <span style={{ fontSize: 12.5, color: "var(--color-text-tertiary)" }}>{ago(c.createdAt)}</span>
                {c.canDelete && (
                  <IconButton
                    label="Delete comment"
                    style={{ marginLeft: "auto", width: 28, height: 28 }}
                    onClick={() => void remove({ commentId: c._id })}
                  >
                    <Trash2 size={13} strokeWidth={1.8} aria-hidden />
                  </IconButton>
                )}
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{withMentions(c.body, c.mentions)}</p>
            </div>
          </div>
        ))}
      </div>
      {data.canComment && (
        <form
          style={{ display: "flex", gap: 8, marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <MentionField
            placeholder="Comment for your team. Type @ to mention someone"
            label="Comment on this response"
            people={people}
            value={draft}
            onChange={setDraft}
            onSubmitShortcut={() => void send()}
          />
          <IconButton label="Send comment" type="submit" disabled={!draft.trim() || busy}>
            <Send size={15} strokeWidth={1.8} aria-hidden />
          </IconButton>
        </form>
      )}
    </div>
  );
}
