"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useToast } from "@/components/ui/Toast";
import { DraftPill } from "./editor/Draft";
import { errorText } from "./settings/bits";

type Quiz = {
  score: number;
  max: number;
  percent: number;
  passed: boolean | null;
  pending: number;
  timedOut: boolean;
  late: boolean;
  marks: { blockId: Id<"blocks">; got: number; max: number; manual: boolean }[];
};

/**
 * Business: a quiz response's mark, question by question. Written answers
 * are marked here by hand; any automatic mark can be changed too.
 */
export function QuizMarks({
  responseId,
  quiz,
  titles,
}: {
  responseId: Id<"responses">;
  quiz: Quiz | null;
  titles: Map<string, string>;
}) {
  const toast = useToast();
  const grade = useMutation(api.quiz.grade);
  if (!quiz) return null;

  return (
    <div className="fk-resp-quiz">
      <div className="fk-resp-group-title">Quiz</div>
      <div className="fk-resp-quiz-head">
        <strong>
          {quiz.score} / {quiz.max}
        </strong>
        <span>{quiz.percent}%</span>
        {quiz.passed !== null && (
          <span className="fk-insight-chip" data-tone={quiz.passed ? "positive" : "negative"}>
            {quiz.passed ? "Pass" : "Fail"}
          </span>
        )}
        {quiz.pending > 0 && <span className="fk-insight-chip">{quiz.pending} to mark</span>}
        {quiz.timedOut && <span className="fk-insight-chip">Time ran out</span>}
        {quiz.late && <span className="fk-insight-chip" data-tone="negative">Sent late</span>}
      </div>
      {quiz.marks.map((m) => (
        <div key={m.blockId} className="fk-resp-quiz-row" data-manual={m.manual ? "true" : undefined}>
          <span className="fk-resp-quiz-q">{titles.get(m.blockId) ?? "A question no longer on the form"}</span>
          <DraftPill
            aria-label={`Marks for ${titles.get(m.blockId) ?? "this question"}`}
            inputMode="decimal"
            placeholder={m.manual ? "Mark" : undefined}
            value={m.manual ? "" : String(m.got)}
            wrapStyle={{ width: 74 }}
            onCommit={async (v) => {
              if (v.trim() === "") return;
              try {
                await grade({ responseId, blockId: m.blockId, got: Number(v) || 0 });
              } catch (e) {
                toast(errorText(e, "That mark did not save."));
              }
            }}
          />
          <span className="fk-resp-quiz-max">/ {m.max}</span>
        </div>
      ))}
    </div>
  );
}
