"use client";

import { useState } from "react";

/**
 * "Was this helpful?" - acknowledges either answer and says what happens next,
 * rather than thanking you and moving on.
 */
export function HelpFeedback({ articleId }: { articleId: string }) {
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);

  return (
    <div
      style={{
        marginTop: "clamp(30px,4vw,48px)",
        paddingTop: 22,
        boxShadow: "inset 0 1px 0 var(--neutral-200)",
      }}
    >
      {answer === null ? (
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
        >
          <span style={{ fontSize: 15, fontWeight: 500 }}>Was this helpful?</span>
          <button
            type="button"
            className="fk-chip"
            onClick={() => setAnswer("yes")}
            data-article={articleId}
          >
            Yes
          </button>
          <button
            type="button"
            className="fk-chip"
            onClick={() => setAnswer("no")}
            data-article={articleId}
          >
            No
          </button>
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--color-text-secondary)",
            textWrap: "pretty",
          }}
        >
          {answer === "yes"
            ? "Good, thank you. That tells us to leave this one alone."
            : "Noted. This article is on the list to rewrite; if you tell support what you were trying to do, we will cover it."}
        </p>
      )}
    </div>
  );
}
