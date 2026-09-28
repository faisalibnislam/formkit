"use client";

import { useViewer } from "@/lib/seed";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The help centre's way on: into the product. Signed out, it offers an
 * account; signed in, it goes back to the dashboard rather than asking
 * somebody who already has one to sign up.
 */
export function HelpCta() {
  const viewer = useViewer();
  const signedIn = Boolean(viewer);
  return (
    <div className="fk-help-cta">
      <div>
        <strong>{signedIn ? "Back to your forms" : "Try it on a form of your own"}</strong>
        <span>
          {signedIn
            ? "Everything in this article is a click or two away in the builder."
            : "Free to start, with unlimited forms and responses. No card needed."}
        </span>
      </div>
      <Link href={signedIn ? "/app" : "/signup"} className="fk-pill fk-pill-dark">
        {signedIn ? "Go to dashboard" : "Start building free"}
        <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
      </Link>
    </div>
  );
}
