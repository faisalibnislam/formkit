"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { api } from "../../../convex/_generated/api";

/**
 * "Was this helpful?" - acknowledges either answer and says what happens next,
 * rather than thanking you and moving on.
 */
export function HelpFeedback({ articleId }: { articleId: string }) {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const log = useMutation(api.helpSignals.log);
  const choose = (a: "yes" | "no") => {
    setAnswer(a);
    void log({ kind: a === "yes" ? "helpful" : "unhelpful", key: articleId }).catch(() => {});
  };

  return (
    <div className="fk-help-fb" data-answered={answer ?? undefined}>
      {answer === null ? (
        <>
          <span className="fk-help-fb-q">Was this helpful?</span>
          <span className="fk-help-fb-btns">
            <button type="button" onClick={() => choose("yes")} data-article={articleId}>
              <ThumbsUp size={16} strokeWidth={2} aria-hidden /> Yes
            </button>
            <button type="button" onClick={() => choose("no")} data-article={articleId}>
              <ThumbsDown size={16} strokeWidth={2} aria-hidden /> No
            </button>
          </span>
        </>
      ) : (
        <p>
          {answer === "yes"
            ? "Good, thank you. That tells us to leave this one alone."
            : "Noted, thank you. Articles people mark unhelpful are the ones we rewrite first. If you tell support what you were trying to do, we will cover it."}
        </p>
      )}
    </div>
  );
}
