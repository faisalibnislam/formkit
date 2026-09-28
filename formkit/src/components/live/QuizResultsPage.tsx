"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Shell } from "./FormRunner";
import { QuizResultCard } from "./QuizResult";

/** Business: the results page a quiz links to. */
export function QuizResultsPage({ token }: { token: string }) {
  const r = useQuery(api.quiz.result, { token });
  if (r === undefined) return null;
  if (r === null) {
    return (
      <div className="fk-live">
        <div className="fk-live-inner">
          <h1>No results here</h1>
          <p className="fk-live-lede">That link doesn’t lead to a quiz result. Check it against the one you were sent.</p>
        </div>
      </div>
    );
  }
  return (
    <Shell theme={null} brand={r.brand}>
      <div style={{ paddingTop: "4vh", textAlign: "center" }}>
        <h1>{r.title}</h1>
        <p className="fk-live-lede">
          {r.name ? `${r.name.split(/\s+/)[0]}, here` : "Here"} {r.released ? "are your results." : "is where your results will be."}
        </p>
      </div>
      <QuizResultCard r={r} token={token} full />
    </Shell>
  );
}
