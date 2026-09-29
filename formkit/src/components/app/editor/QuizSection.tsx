"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { GraduationCap, Send } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button, Field, Segmented, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { ProChip } from "@/components/plan/UpgradeSheet";
import { openUpgrade, upgradeOnPlanError, useGate } from "@/components/plan/usePlan";
import { errorText } from "../settings/bits";
import { BarChart, StatCard, TickBars } from "../ds";
import { fullTime } from "../bits";
import { DraftPill } from "./Draft";
import { tracked } from "./saveStatus";

/**
 * Business: the form as a quiz or exam - marks, a timer, one attempt, and
 * results shown straight away or released later.
 */

type Form = NonNullable<FunctionReturnType<typeof api.forms.get>>;
type Settings = {
  enabled: boolean;
  timeLimit?: number;
  passMark?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  oneAttempt?: boolean;
  results: "instant" | "later";
  showAnswers?: boolean;
  emailResults?: boolean;
  releaseAt?: number;
};

const toLocalInput = (at?: number) => {
  if (!at) return "";
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function QuizSection({ formId, form }: { formId: Id<"forms">; form: Form }) {
  const toast = useToast();
  const gate = useGate("quiz", form.ownerPlan?.features);
  const save = useMutation(api.quiz.save);
  const release = useMutation(api.quiz.release);
  const summary = useQuery(api.quiz.summary, form.quiz?.enabled ? { formId } : "skip");
  const stored: Settings = { enabled: false, results: "instant", ...(form.quiz ?? {}) };
  const [releasing, setReleasing] = useState(false);
  const marked = form.blocks.filter((b) => b.kind === "field" && ((b.answerKey?.length ?? 0) > 0 || (b.marks ?? 0) > 0));
  const hasEmail = form.blocks.some((b) => b.kind === "field" && b.type === "email");

  async function put(patch: Partial<Settings>) {
    try {
      const next = { ...stored, ...patch };
      await tracked(
        save({
          formId,
          settings: {
            enabled: next.enabled,
            timeLimit: next.timeLimit,
            passMark: next.passMark,
            shuffleQuestions: next.shuffleQuestions,
            shuffleOptions: next.shuffleOptions,
            oneAttempt: next.oneAttempt,
            results: next.results,
            showAnswers: next.showAnswers,
            emailResults: next.emailResults,
            releaseAt: next.releaseAt,
          },
        }),
      );
    } catch (e) {
      if (!upgradeOnPlanError(e)) toast(errorText(e, "That did not save."));
    }
  }

  const toggle = (label: string, hint: string, key: keyof Settings) => (
    <div className="fk-proprow">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>{label}</div>
        <div className="fk-proprow-hint">{hint}</div>
      </div>
      <Switch checked={!!stored[key]} label={label} onChange={gate.guard((on: boolean) => void put({ [key]: on }))} />
    </div>
  );

  return (
    <>
      <section className="fk-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GraduationCap size={18} strokeWidth={1.8} aria-hidden style={{ display: "inline-block" }} />
          <h3 style={{ flex: 1, margin: 0 }}>Quiz or exam</h3>
          {gate.locked && <ProChip plan="pro" onClick={() => openUpgrade({ feature: "quiz" })} />}
        </div>
        <p className="fk-panel-lede">
          Mark every response as it arrives. Set the right answers and marks on each question under Build. Written answers
          wait for you to mark them by hand.
        </p>
        <div className="fk-proprow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>This form is a quiz</div>
            <div className="fk-proprow-hint">
              {stored.enabled
                ? `${marked.length} question${marked.length === 1 ? "" : "s"} marked so far.`
                : "Adds right answers and marks to your questions."}
            </div>
          </div>
          <Switch checked={stored.enabled} label="This form is a quiz" onChange={gate.guard((enabled: boolean) => void put({ enabled }))} />
        </div>

        {stored.enabled && (
          <>
            <div className="fk-quiz-grid">
              <Field label="Time limit (minutes)">
                <DraftPill
                  size="md"
                  inputMode="numeric"
                  placeholder="No limit"
                  value={stored.timeLimit ? String(stored.timeLimit) : ""}
                  onCommit={(v) => void put({ timeLimit: Number(v) > 0 ? Number(v) : undefined })}
                />
              </Field>
              <Field label="Pass mark (%)">
                <DraftPill
                  size="md"
                  inputMode="numeric"
                  placeholder="No pass or fail"
                  value={typeof stored.passMark === "number" ? String(stored.passMark) : ""}
                  onCommit={(v) => void put({ passMark: v.trim() === "" ? undefined : Number(v) })}
                />
              </Field>
            </div>
            <p className="fk-proprow-hint" style={{ margin: "6px 0 4px" }}>
              {stored.timeLimit
                ? `A countdown shows from the moment they start. At ${stored.timeLimit} minutes the quiz sends itself with whatever is answered.`
                : "Without a limit, people take as long as they like."}
            </p>
            {toggle("Shuffle the questions", "Each person gets the questions on each page in a different order.", "shuffleQuestions")}
            {toggle("Shuffle the options", "Choice questions list their options in a different order for each person.", "shuffleOptions")}
            {toggle("One attempt each", "Once per device and per email address.", "oneAttempt")}
          </>
        )}
      </section>

      {stored.enabled && (
        <section className="fk-panel">
          <h3 style={{ margin: "0 0 6px" }}>Results</h3>
          <p className="fk-panel-lede">What people see after sending, and when.</p>
          <div className="fk-proprow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>When people see their results</div>
              <div className="fk-proprow-hint">
                {stored.results === "instant"
                  ? "On the thank-you screen, as soon as they send."
                  : stored.releaseAt
                    ? `Held until ${fullTime(stored.releaseAt)}, or until you release them.`
                    : "Held until you release them. Good for exams you mark first."}
              </div>
            </div>
            <Segmented
              ariaLabel="When people see their results"
              size="sm"
              value={stored.results}
              onChange={(results) => void put({ results })}
              options={[
                { value: "instant", label: "Straight away" },
                { value: "later", label: "Later" },
              ]}
            />
          </div>
          {stored.results === "later" && (
            <div className="fk-proprow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>Release them at</div>
                <div className="fk-proprow-hint">Optional. Or release them yourself below.</div>
              </div>
              <span className="ui-input-wrap" data-size="sm" style={{ width: 230 }}>
                <input
                  type="datetime-local"
                  aria-label="Release them at"
                  defaultValue={toLocalInput(stored.releaseAt)}
                  onBlur={(e) => {
                    const at = e.target.value ? new Date(e.target.value).getTime() : undefined;
                    if (at !== stored.releaseAt) void put({ releaseAt: at });
                  }}
                />
              </span>
            </div>
          )}
          {toggle("Show the right answers", "Their results list every question, what they answered and the right answer.", "showAnswers")}
          <div className="fk-proprow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>Email people their results</div>
              <div className="fk-proprow-hint">
                {hasEmail
                  ? "A link to their results page, once they’re out and fully marked."
                  : "Needs an email question on the form."}
              </div>
            </div>
            <Switch
              checked={!!stored.emailResults}
              label="Email people their results"
              onChange={gate.guard((emailResults: boolean) => void put({ emailResults }))}
            />
          </div>
        </section>
      )}

      {stored.enabled && summary && (
        <section className="fk-panel">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ flex: 1, margin: 0 }}>How it’s going</h3>
            {stored.results === "later" &&
              (summary.released ? (
                <span className="fk-proprow-hint" style={{ margin: 0 }}>
                  Released {summary.releasedAt ? fullTime(summary.releasedAt) : ""}
                </span>
              ) : (
                <Button
                  size="sm"
                  disabled={releasing || summary.count === 0}
                  iconLeft={<Send size={14} strokeWidth={1.8} aria-hidden />}
                  onClick={async () => {
                    setReleasing(true);
                    try {
                      await release({ formId });
                      toast("Results released", {
                        detail: stored.emailResults ? "Everyone fully marked is being emailed." : undefined,
                      });
                    } catch (e) {
                      toast(errorText(e, "Those could not be released."));
                    } finally {
                      setReleasing(false);
                    }
                  }}
                >
                  Release results now
                </Button>
              ))}
          </div>
          <div className="fk-grid" data-cols="stats-sm" style={{ marginTop: 16 }}>
            <StatCard label="Taken" value={summary.count.toLocaleString("en-US")} tone="sunken" />
            <StatCard label="Average" value={summary.average === null ? "-" : `${summary.average}%`} tone="sunken" />
            <StatCard label="Passed" value={summary.passRate === null ? "-" : `${summary.passRate}%`} tone="sunken" />
            <StatCard
              label="To mark by hand"
              value={summary.toMark.toLocaleString("en-US")}
              caption={summary.toMark ? "Open them in Responses" : undefined}
              tone="sunken"
            />
          </div>
          {summary.count > 0 && (
            <div className="fk-grid" data-cols="two" style={{ marginTop: 18, alignItems: "start" }}>
              <div>
                <div className="fk-resp-group-title">Scores</div>
                <BarChart height={150} bars={summary.spread.map((b) => ({ label: b.label, value: b.count }))} />
              </div>
              <div>
                <div className="fk-resp-group-title">Got it right</div>
                <div className="fk-droprows">
                  {summary.questions.map((q) => (
                    <div key={q._id} className="fk-droprow">
                      <span className="fk-droprow-label">{q.title}</span>
                      <span className="fk-droprow-meter">
                        {q.right !== null ? (
                          <TickBars value={q.right} ticks={26} height={16} tone={q.right < 40 ? "negative" : "positive"} />
                        ) : null}
                      </span>
                      <span className="fk-droprow-pct" style={{ whiteSpace: "nowrap" }}>
                        {q.right === null ? (q.keyed ? "-" : "by hand") : `${q.right}%`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
