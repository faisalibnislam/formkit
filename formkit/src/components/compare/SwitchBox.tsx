"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { ArrowRight } from "lucide-react";
import { sourceOf } from "../../../convex/model/importParse";
import { keepImport } from "@/lib/pendingImport";

/**
 * "Switch in 60 seconds": paste a form's link on its compare page; after
 * signing up (or in), it is waiting in Formkit as a draft. Nothing is fetched
 * until there is an account (convex/importForm.ts).
 */
export function SwitchBox({ rival, example }: { rival: string; example: string }) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const [url, setUrl] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <form
      className="fk-switch"
      onSubmit={(e) => {
        e.preventDefault();
        const link = url.trim();
        if (!sourceOf(link)) {
          setProblem(`Paste the link people use to answer your ${rival} form. It starts with https://`);
          return;
        }
        keepImport(link);
        router.push(isAuthenticated ? "/app" : "/signup?next=/app");
      }}
    >
      <label htmlFor="fk-switch-url" className="fk-switch-label">
        Your {rival} form&rsquo;s link
      </label>
      <div className="fk-switch-row">
        <input
          id="fk-switch-url"
          className="fk-switch-input"
          type="url"
          inputMode="url"
          placeholder={example}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setProblem(null);
          }}
          aria-describedby={problem ? "fk-switch-problem" : "fk-switch-help"}
        />
        <button type="submit" className="fk-pill fk-pill-dark fk-pill-md">
          Bring it over <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
      {problem ? (
        <p id="fk-switch-problem" className="fk-switch-problem" role="alert">
          {problem}
        </p>
      ) : (
        <p id="fk-switch-help" className="fk-switch-help">
          {isAuthenticated
            ? "It arrives in your account as a draft. Nothing changes for anyone until you publish."
            : "Make a free account and it is waiting for you as a draft. Nothing changes for anyone until you publish."}
        </p>
      )}
    </form>
  );
}
