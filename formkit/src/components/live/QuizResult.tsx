"use client";

import { useQuery } from "convex/react";
import { Check, Clock3, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/**
 * Business: a quiz taker's mark — on the thank-you screen when results are
 * instant, and on their own results page (/q/…) whenever they are out.
 */

type Result = NonNullable<FunctionReturnType<typeof api.quiz.result>>;

export function QuizResult({ token, full = false }: { token: string; full?: boolean }) {
  const r = useQuery(api.quiz.result, { token });
  if (r === undefined) return null;
  if (r === null) return null;
  return <QuizResultCard r={r} full={full} token={token} />;
}

export function QuizResultCard({ r, full, token }: { r: Result; full?: boolean; token: string }) {
  if (!r.released) {
    return (
      <div className="fk-quizres" data-held="true">
        <div className="fk-quizres-held">
          <Clock3 size={17} strokeWidth={1.8} aria-hidden />
          {r.releaseAt
            ? `Your results will be ready ${new Date(r.releaseAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.`
            : "Your results will be released once everything is marked."}
        </div>
        {!full && (
          <a className="fk-quizres-link" href={`/q/${token}`}>
            Bookmark your results page
          </a>
        )}
      </div>
    );
  }

  const verdict = r.passed === null ? null : r.passed ? "Pass" : "Not a pass";
  return (
    <div className="fk-quizres">
      <div className="fk-quizres-score">
        <div className="fk-quizres-ring" style={{ ["--pct" as string]: `${Math.min(100, r.percent)}%` }}>
          <span>{Math.round(r.percent)}%</span>
        </div>
        <div>
          <div className="fk-quizres-big">
            {r.score} <span>out of {r.max}</span>
          </div>
          {verdict && (
            <div className="fk-quizres-verdict" data-passed={r.passed ? "true" : "false"}>
              {verdict}
              {r.passMark !== null && <span> · pass mark {r.passMark}%</span>}
            </div>
          )}
          {r.pending > 0 && (
            <div className="fk-quizres-note">
              {r.pending} written {r.pending === 1 ? "answer is" : "answers are"} still to be marked, so this may go up.
            </div>
          )}
          {r.timedOut && <div className="fk-quizres-note">Sent when the time ran out.</div>}
        </div>
      </div>
      {r.questions && (full || r.questions.length <= 12) && (
        <ol className="fk-quizres-list">
          {r.questions.map((q, i) => {
            const right = !q.manual && q.got >= q.max;
            return (
              <li key={i} data-right={q.manual ? undefined : right ? "true" : "false"}>
                <span className="fk-quizres-mark" aria-hidden>
                  {q.manual ? "·" : right ? <Check size={14} strokeWidth={2.4} /> : <X size={14} strokeWidth={2.4} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fk-quizres-q">{q.title}</div>
                  <div className="fk-quizres-a">
                    You said: {q.given || <em>nothing</em>}
                    {!right && q.answer && <> · Answer: {q.answer}</>}
                  </div>
                </div>
                <span className="fk-quizres-pts">
                  {q.manual ? "to mark" : `${q.got}/${q.max}`}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {!full && (
        <a className="fk-quizres-link" href={`/q/${token}`}>
          Your results page
        </a>
      )}
    </div>
  );
}
