"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LiveForm } from "./LiveForm";

/**
 * Coming back to a form somebody left half-answered.
 *
 * The token resolves to the partial response itself, so their answers are put
 * back rather than asked for again, and finishing replaces that record instead
 * of leaving a partial and a complete side by side.
 */
export function ResumeForm({ token }: { token: string }) {
  const found = useQuery(api.publicForm.resume, { token });

  if (found === undefined) return null;

  if (found === null) {
    return (
      <div className="fk-live">
        <div className="fk-live-inner">
          <h1>That link has already been used</h1>
          <p style={{ marginTop: 12, opacity: 0.7 }}>
            Either the form was finished, or it is no longer collecting. Ask whoever sent it for a
            fresh link.
          </p>
        </div>
      </div>
    );
  }

  const answers: Record<string, { value?: string; values?: string[]; fileName?: string }> = {};
  for (const a of found.answers) {
    answers[a.blockId] = {
      ...(a.value !== null ? { value: a.value } : {}),
      ...(a.values !== null ? { values: a.values } : {}),
      ...(a.fileName !== null ? { fileName: a.fileName } : {}),
    };
  }

  return (
    <LiveForm
      slug={found.slug}
      handle={found.handle ?? undefined}
      resume={{ responseId: found.responseId as Id<"responses">, answers }}
    />
  );
}
