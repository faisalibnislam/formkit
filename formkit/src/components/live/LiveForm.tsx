"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Lock } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { buttonInk, themeOf } from "@/components/app/editor/themes";
import { FormRunner, Shell, type Answer, type OpenForm, type SubmitArgs } from "./FormRunner";
import { sourceLabel } from "./source";

/**
 * The public link. It fetches the form, asks for its password when it has one,
 * shows the closed or not-yet-published screens, and otherwise hands over to
 * the runner — which the builder's preview uses too.
 */

const DEVICE_KEY = "fk.device";

/** A random id this browser keeps, for the per-device rules. Never personal. */
function deviceId() {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export function LiveForm({
  slug,
  handle,
  resume,
}: {
  slug: string;
  handle?: string;
  /** Somebody coming back to a form; their answers are already here. */
  resume?: { token: string; answers: Record<string, Answer>; editing: boolean };
}) {
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [typed, setTyped] = useState("");
  const data = useQuery(api.publicForm.bySlug, { slug, handle, password });
  const recordView = useMutation(api.publicForm.recordView);
  const uploadUrl = useMutation(api.publicForm.uploadUrl);
  const submit = useMutation(api.publicForm.submit);
  const checkout = useAction(api.payments.checkout);
  const think = useAction(api.aiLogic.think);
  const startQuiz = useMutation(api.publicForm.startQuiz);
  const viewed = useRef(false);

  const open = data?.state === "open" ? data : null;

  useEffect(() => {
    if (open && !viewed.current) {
      viewed.current = true;
      void recordView({ formId: open.formId, source: sourceLabel() });
    }
  }, [open, recordView]);

  const onSubmit = useCallback(
    (args: SubmitArgs) =>
      submit({
        formId: open!.formId,
        ...args,
        password,
        resumeToken: resume?.token,
        deviceId: deviceId(),
        source: sourceLabel(),
      }),
    [open, password, resume?.token, submit],
  );

  const upload = useCallback(
    async (file: File) => {
      const url = await uploadUrl({});
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      return storageId;
    },
    [uploadUrl],
  );

  if (data === undefined) return null;

  if (data === null) {
    return (
      <Shell theme={null}>
        <h1>That form is not here</h1>
        <p className="fk-live-lede">The link may be mistyped, or the form may have been deleted.</p>
      </Shell>
    );
  }

  if (data.state === "draft") {
    return (
      <Shell theme={null}>
        <h1>Not published yet</h1>
        <p className="fk-live-lede">
          Whoever sent you this link has not finished the form. Ask them for it again in a while.
        </p>
      </Shell>
    );
  }

  if (data.state === "closed") {
    return (
      <Shell theme={themeOf(data.theme)} brand={data.brand} logos={data.logos}>
        <div style={{ paddingTop: "8vh", textAlign: "center" }}>
          <span className="fk-live-lock">
            <Lock size={30} strokeWidth={1.8} aria-hidden />
          </span>
          <h1 style={{ marginTop: 22 }}>{data.title}</h1>
          <p className="fk-live-lede">{data.message}</p>
        </div>
      </Shell>
    );
  }

  if (data.state === "locked") {
    const theme = themeOf(data.theme);
    return (
      <Shell theme={theme} brand={data.brand} logos={data.logos}>
        <form
          style={{ paddingTop: "6vh", maxWidth: 420 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) setPassword(typed.trim());
          }}
        >
          <span className="fk-live-lock">
            <Lock size={30} strokeWidth={1.8} aria-hidden />
          </span>
          <h1 style={{ marginTop: 22 }}>{data.title}</h1>
          <p className="fk-live-lede">This form is private. Enter the password you were given.</p>
          <input
            className="fk-live-input"
            type="password"
            autoComplete="current-password"
            aria-label="Password"
            placeholder="Password"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            style={{ marginTop: 22, borderRadius: Math.min(theme.radius, 24) }}
          />
          {data.wrong && (
            <div className="fk-live-err" role="alert">
              That is not the password. Check it with whoever sent you the link.
            </div>
          )}
          <div className="fk-live-foot">
            <button
              type="submit"
              style={{
                height: 52,
                padding: "0 28px",
                border: "none",
                borderRadius: Math.min(theme.radius, 999),
                background: theme.primary,
                color: buttonInk(theme.primary),
                font: "inherit",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Open the form
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  return (
    <FormRunner
      data={data as OpenForm}
      mode="live"
      resume={resume}
      onSubmit={onSubmit}
      onPay={checkout}
      onThink={(a) => think({ formId: (data as OpenForm).formId, ...a })}
      onStartQuiz={() => startQuiz({ formId: (data as OpenForm).formId, deviceId: deviceId() })}
      onStart={() => void recordView({ formId: data.formId, started: true, source: sourceLabel() })}
      upload={upload}
    />
  );
}
