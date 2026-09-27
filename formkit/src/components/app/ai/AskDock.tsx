"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Maximize2, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Drawer } from "@/components/ui";
import { useAsk } from "./AskProvider";
import { AskCanvas, AskComposer, AskCredits, AskLimitModal, AskTarget, AskThread } from "./AskParts";

/**
 * Ask Formkit away from its own page: a launcher in the corner that opens a
 * side drawer with the same conversation. In the builder the drawer works on
 * the form that is open.
 *
 * The launcher starts out saying what it is, then settles to a small pill once
 * it has been used or the page has been scrolled.
 */
export function AskDock() {
  const ask = useAsk();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const onPage = pathname.startsWith("/app/ask");
  const inBuilder = /^\/app\/forms\/[^/]+/.test(pathname);
  const form = useQuery(api.forms.get, ask.formId && inBuilder ? { formId: ask.formId } : "skip");
  const [calm, setCalm] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    const settle = () => {
      if (window.scrollY > 120) setCalm(true);
    };
    window.addEventListener("scroll", settle, { passive: true });
    const t = window.setTimeout(() => setCalm(true), 9000);
    return () => {
      window.removeEventListener("scroll", settle);
      window.clearTimeout(t);
    };
  }, []);

  // The full page has the conversation already; the drawer would be a copy.
  useEffect(() => {
    if (onPage) ask.setDrawerOpen(false);
  }, [onPage, ask]);

  return (
    <>
      {!onPage && !ask.drawerOpen && (
        <button
          type="button"
          className="fk-ask-launch"
          data-calm={calm || ask.thread.length > 0 ? "true" : undefined}
          aria-label={`Ask Formkit — ${ask.left} form ${ask.left === 1 ? "credit" : "credits"} left`}
          onClick={() => {
            opened.current = true;
            setCalm(true);
            ask.setDrawerOpen(true);
          }}
        >
          <span className="fk-ask-launch-mark" aria-hidden>
            <Sparkles size={16} strokeWidth={1.8} />
          </span>
          <span className="fk-ask-launch-label">
            {inBuilder ? "Ask Formkit about this form" : "Ask Formkit"}
          </span>
          <span className="fk-ask-launch-count" aria-hidden>
            {ask.left}
          </span>
        </button>
      )}

      {ask.drawerOpen && !onPage && (
        <Drawer title="Ask Formkit" onClose={() => ask.setDrawerOpen(false)} footer={<AskComposer autoFocus />}>
          <div className="fk-ask-drawer">
            <div className="fk-ask-drawer-head">
              {inBuilder ? (
                <span className="fk-ask-quiet">Working on {form?.title ?? "this form"}</span>
              ) : (
                <span className="fk-ask-hero-target">
                  <span className="fk-ask-quiet">Working on</span>
                  <AskTarget />
                </span>
              )}
              <span style={{ flex: 1 }} />
              <button type="button" className="fk-ask-link" onClick={ask.newChat} disabled={ask.busy}>
                New chat
              </button>
              <button
                type="button"
                className="fk-ask-link"
                onClick={() => {
                  ask.setDrawerOpen(false);
                  router.push("/app/ask");
                }}
              >
                <Maximize2 size={13} strokeWidth={1.8} aria-hidden /> Full page
              </button>
            </div>
            {ask.thread.length === 0 && (
              <p className="fk-ask-quiet" style={{ margin: 0 }}>
                {inBuilder
                  ? "Ask me to add questions, rewrite them in another tone, write logic rules, pick a theme or read the responses."
                  : "Describe a form in a sentence and I will write it, or pick one of yours and ask for a change."}
              </p>
            )}
            <AskThread />
            <AskCanvas inline />
            <AskCredits compact />
          </div>
        </Drawer>
      )}

      <AskLimitModal />
    </>
  );
}
