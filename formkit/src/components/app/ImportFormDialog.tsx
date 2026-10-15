"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { ArrowRight, FileUp, Link2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button, Field, Input, Modal } from "@/components/ui";
import { errorText } from "./settings/bits";

/**
 * Bringing a form over from another tool (convex/importForm.ts): a public
 * link, or an exported file. It arrives as a draft; anything that could not
 * come over is listed before opening it.
 */

type Done = { formId: string; from: string; questions: number; skipped: string[]; usedAi: boolean };

export function ImportFormDialog({
  onClose,
  onBack,
  initialUrl,
  autoStart,
}: {
  onClose: () => void;
  onBack?: () => void;
  /** A link brought from a compare page (PendingImport), imported straight away when `autoStart`. */
  initialUrl?: string;
  autoStart?: boolean;
}) {
  const router = useRouter();
  const fromLink = useAction(api.importForm.fromLink);
  const fromFile = useAction(api.importForm.fromFile);
  const file = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  async function run(work: () => Promise<Done>) {
    setBusy(true);
    setProblem(null);
    try {
      setDone(await work());
    } catch (e) {
      setProblem(errorText(e, "That form could not be imported."));
    } finally {
      setBusy(false);
    }
  }

  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || !initialUrl || started.current) return;
    started.current = true;
    void run(() => fromLink({ url: initialUrl }) as Promise<Done>);
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) {
    return (
      <Modal
        title="Your form is here"
        description={`${done.questions} ${done.questions === 1 ? "question" : "questions"} from ${done.from}, as a draft. Check it over, then publish.${done.usedAi ? " The AI read it, which used one AI-built form." : ""}`}
        onClose={onClose}
        width={560}
        footer={
          <Button
            iconRight={<ArrowRight size={16} strokeWidth={1.8} aria-hidden />}
            onClick={() => {
              onClose();
              router.push(`/app/forms/${done.formId}`);
            }}
          >
            Open the form
          </Button>
        }
      >
        {done.skipped.length > 0 ? (
          <>
            <p style={{ margin: "0 0 8px", fontSize: 14.5 }}>Add these by hand. Formkit could not bring them over:</p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
              {done.skipped.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--color-text-secondary)" }}>Everything came over. Logic rules are not copied, so add any it needs.</p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      title="Import a form"
      description="From Google Forms, Typeform, Tally or Jotform. It arrives as a draft, so nothing changes for anyone until you publish."
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onBack ?? onClose}>
            {onBack ? "Back" : "Cancel"}
          </Button>
          <Button
            disabled={busy || !url.trim()}
            iconRight={<ArrowRight size={16} strokeWidth={1.8} aria-hidden />}
            onClick={() => void run(() => fromLink({ url: url.trim() }) as Promise<Done>)}
          >
            {busy ? "Importing…" : "Import"}
          </Button>
        </>
      }
    >
      <Field label="The form's public link" help="The address people open to answer it. Google Forms and Typeform are copied as they are; Tally and Jotform are read by AI.">
        <Input
          value={url}
          autoFocus
          placeholder="https://docs.google.com/forms/d/e/…/viewform"
          icon={<Link2 size={17} strokeWidth={1.8} aria-hidden />}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.trim() && !busy) void run(() => fromLink({ url: url.trim() }) as Promise<Done>);
          }}
        />
      </Field>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <Button variant="secondary" size="sm" disabled={busy} iconLeft={<FileUp size={15} strokeWidth={1.8} aria-hidden />} onClick={() => file.current?.click()}>
          Or choose an exported file
        </Button>
        <span style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
          JSON from Typeform or Formkit, CSV or text. For a PDF or document,{" "}
          <Link href="/app/ask" className="fk-linkbtn" onClick={onClose}>
            ask Formkit
          </Link>
          .
        </span>
        <input
          ref={file}
          type="file"
          accept=".json,.csv,.txt,application/json,text/csv,text/plain"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 2_000_000) {
              setProblem("That file is over 2 MB. Export just the form, without its responses.");
              return;
            }
            const text = await f.text();
            void run(() => fromFile({ name: f.name, text }) as Promise<Done>);
          }}
        />
      </div>
      {problem && (
        <p className="ui-error" style={{ margin: "14px 0 0" }}>
          {problem}
        </p>
      )}
    </Modal>
  );
}
