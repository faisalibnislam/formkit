"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Answer } from "./FormRunner";
import { LiveForm } from "./LiveForm";

/**
 * Coming back to a form: one somebody left half-answered, or - where the form
 * allows it - one they sent and want to change.
 *
 * The token resolves to the response itself, so the answers are put back
 * rather than asked for again, and finishing replaces that record instead of
 * leaving two side by side.
 */
export function ResumeForm({ token }: { token: string }) {
  const found = useQuery(api.publicForm.resume, { token });

  if (found === undefined) return null;

  if (found === null) {
    return (
      <div className="fk-live">
        <div className="fk-live-inner">
          <h1>That link has already been used</h1>
          <p className="fk-live-lede">
            Either the form was finished, or it is no longer collecting. Ask whoever sent it for a
            fresh link.
          </p>
        </div>
      </div>
    );
  }

  const answers: Record<string, Answer> = {};
  for (const a of found.answers) {
    answers[a.blockId] = {
      ...(a.value !== null ? { value: a.value } : {}),
      ...(a.values !== null ? { values: a.values } : {}),
      ...(a.fileName !== null ? { fileName: a.fileName } : {}),
      ...(a.fileId !== null ? { fileId: a.fileId } : {}),
    };
  }

  return (
    <LiveForm
      slug={found.slug}
      handle={found.handle ?? undefined}
      resume={{ token, answers, editing: found.editing }}
    />
  );
}
