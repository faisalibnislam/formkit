"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Mail, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * Business: the reply written for this person, on the thank-you screen. It
 * appears as soon as it's ready; if it takes too long, or goes by email only,
 * the screen says where to look instead of making anyone wait.
 */
export function LiveReply({ responseId, token }: { responseId: Id<"responses">; token: string }) {
  const r = useQuery(api.aiReply.forRespondent, { responseId, token });
  const rate = useMutation(api.aiReply.rate);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 20_000);
    return () => window.clearTimeout(t);
  }, []);

  if (!r || r.status === "skipped" || r.status === "failed") return null;
  const byEmail = r.delivery !== "form" && r.hasEmail;

  if (r.delivery === "email") {
    return byEmail ? (
      <div className="fk-live-reply" aria-live="polite">
        <div className="fk-live-reply-wait">
          <Mail size={17} strokeWidth={1.8} aria-hidden style={{ display: "inline-block" }} />
          {r.emailed ? "A reply is in your inbox." : "A reply written for you is on its way to your inbox."}
        </div>
      </div>
    ) : null;
  }

  if (r.status === "pending") {
    if (slow) {
      return byEmail ? (
        <div className="fk-live-reply" aria-live="polite">
          <div className="fk-live-reply-wait">
            <Mail size={17} strokeWidth={1.8} aria-hidden style={{ display: "inline-block" }} />
            Your reply is taking a moment. We’ll email it to you as well.
          </div>
        </div>
      ) : null;
    }
    return (
      <div className="fk-live-reply" aria-live="polite">
        <div className="fk-live-reply-wait">
          <span className="fk-live-reply-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          Writing a reply for you…
        </div>
      </div>
    );
  }

  if (!r.text) return null;
  return (
    <div className="fk-live-reply" aria-live="polite">
      <div className="fk-live-reply-label">
        <Sparkles size={14} strokeWidth={1.8} aria-hidden />
        A reply for you{byEmail ? ". We’ve emailed you a copy" : ""}
      </div>
      <div className="fk-live-reply-text">{r.text}</div>
      {r.signature && <div className="fk-live-reply-text fk-live-reply-sig">{r.signature}</div>}
      <div className="fk-live-reply-rate">
        Was this helpful?
        <button
          type="button"
          aria-label="Helpful"
          aria-pressed={r.rating === "up"}
          onClick={() => void rate({ responseId, token, rating: "up" })}
        >
          <ThumbsUp size={15} strokeWidth={1.8} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Not helpful"
          aria-pressed={r.rating === "down"}
          onClick={() => void rate({ responseId, token, rating: "down" })}
        >
          <ThumbsDown size={15} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </div>
  );
}
