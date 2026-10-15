"use client";

import { Turnstile, TURNSTILE_SITE_KEY } from "./Turnstile";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Clock, Lock } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { buttonInk, themeOf } from "@/components/app/editor/themes";
import { isLang, tr, type Lang } from "./i18n";

const langOf = (x: unknown): Lang => (isLang(x) ? x : "en");
import { FormRunner, Shell, type Answer, type OpenForm, type SubmitArgs } from "./FormRunner";
import { sourceLabel, utmOf } from "./source";

/**
 * The public link. It fetches the form, asks for its password when it has one,
 * shows the closed or not-yet-published screens, and otherwise hands over to
 * the runner - which the builder's preview uses too.
 */

const DEVICE_KEY = "fk.device";

/** For browsers that keep nothing: an id for as long as the page is open. */
let pageDevice: string | undefined;

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
    try {
      pageDevice ??= crypto.randomUUID();
      return pageDevice;
    } catch {
      return undefined;
    }
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
  const payFirst = useAction(api.payments.start);
  const think = useAction(api.aiLogic.think);
  const followUp = useAction(api.aiLogic.followUp);
  const startQuiz = useMutation(api.publicForm.startQuiz);
  const viewed = useRef(false);

  const open = data?.state === "open" ? data : null;

  useEffect(() => {
    if (open && !viewed.current) {
      viewed.current = true;
      void recordView({ formId: open.formId, source: sourceLabel(), deviceId: deviceId() });
    }
  }, [open, recordView]);

  // The spam check: a Turnstile token, traded for a one-time pass as a
  // finished form is sent. Without one the server asks for the tick box.
  const verifyHuman = useAction(api.publicForm.verifyHuman);
  const captcha = useRef<string | null>(null);
  const resetCaptcha = useRef<() => void>(() => {});
  const checking = !!open?.rules.spam && !!TURNSTILE_SITE_KEY;

  // Embedded on another site: tell the page how tall the form is, so its
  // frame can fit it (embed.js does), and when it has been sent.
  useEffect(() => {
    if (!open || window.parent === window) return;
    // The page fills its frame (min-height 100vh), so measure what is in it:
    // the form's content and the padding below it.
    const post = () => {
      const live = document.querySelector<HTMLElement>(".fk-live");
      const inner = document.querySelector<HTMLElement>(".fk-live-inner");
      const height = inner && live
        ? inner.getBoundingClientRect().bottom + window.scrollY + parseFloat(getComputedStyle(live).paddingBottom || "0")
        : document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "formkit:resize", height: Math.ceil(height) }, "*");
    };
    // Pages swap their content, so any change in the form is a cue to
    // measure again (debounced; a timer, since animation frames pause in a
    // frame the browser is not showing), and to watch the content now there.
    let queued = 0;
    const watch = new ResizeObserver(() => schedule());
    const schedule = () => {
      if (queued) return;
      queued = window.setTimeout(() => {
        queued = 0;
        const inner = document.querySelector(".fk-live-inner");
        if (inner) watch.observe(inner);
        post();
      }, 60);
    };
    const changes = new MutationObserver(schedule);
    changes.observe(document.body, { childList: true, subtree: true });
    watch.observe(document.body);
    schedule();
    return () => {
      watch.disconnect();
      changes.disconnect();
      window.clearTimeout(queued);
    };
  }, [open]);

  // The token a partial save comes back with is kept for this visit, so the
  // final send (or a later partial) updates that record, not a second one.
  const tokenKey = open ? `fk_partial_${open.formId}` : "";
  const keptToken = () => {
    try {
      return tokenKey ? (window.sessionStorage.getItem(tokenKey) ?? undefined) : undefined;
    } catch {
      return undefined;
    }
  };
  const emailResume = useMutation(api.publicForm.emailResumeLink);
  const saveForLater = useCallback(
    async (email: string, token: string) => {
      await emailResume({ formId: open!.formId, resumeToken: token, email });
    },
    [open, emailResume],
  );

  const onSubmit = useCallback(
    async (args: SubmitArgs) => {
      let pass: Id<"humanPasses"> | undefined;
      if (checking && !args.partial && captcha.current) {
        pass = (await verifyHuman({ formId: open!.formId, token: captcha.current }).catch(() => null)) ?? undefined;
        resetCaptcha.current();
      }
      const sent = await submit({
        formId: open!.formId,
        ...args,
        ...(pass ? { pass } : {}),
        password,
        resumeToken: resume?.token ?? keptToken(),
        deviceId: deviceId(),
        source: sourceLabel(),
        utm: utmOf(),
      });
      try {
        if (sent && tokenKey) {
          if (args.partial) window.sessionStorage.setItem(tokenKey, sent.resumeToken);
          else window.sessionStorage.removeItem(tokenKey);
        }
      } catch {
        /* storage blocked: a second record is the worst of it */
      }
      if (sent && !args.partial && window.parent !== window) {
        window.parent.postMessage({ type: "formkit:submit", responseId: sent.responseId, formId: open!.formId }, "*");
      }
      return sent;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keptToken reads storage at call time
    [open, password, resume?.token, submit, verifyHuman, checking, tokenKey],
  );

  // Pay first: the same answers and checks as sending, held while the person pays (payments.start).
  const onPayFirst = useCallback(
    async (args: SubmitArgs & { chosen?: number }) => {
      let pass: Id<"humanPasses"> | undefined;
      if (checking && captcha.current) {
        pass = (await verifyHuman({ formId: open!.formId, token: captcha.current }).catch(() => null)) ?? undefined;
        resetCaptcha.current();
      }
      return await payFirst({
        formId: open!.formId,
        ...args,
        ...(pass ? { pass } : {}),
        password,
        resumeToken: resume?.token ?? keptToken(),
        deviceId: deviceId(),
        source: sourceLabel(),
        utm: utmOf(),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keptToken reads storage at call time
    [open, password, resume?.token, payFirst, verifyHuman, checking],
  );

  const upload = useCallback(
    async (file: File) => {
      const url = await uploadUrl({ formId: open!.formId, deviceId: deviceId() });
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      return storageId;
    },
    [open, uploadUrl],
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
        <h1>This form is not available</h1>
        <p className="fk-live-lede">
          It is not open for answers at the moment. Check with whoever sent you the link.
        </p>
      </Shell>
    );
  }

  if (data.state === "soon") {
    const when = new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
      timeStyle: "short",
      ...(data.timezone ? { timeZone: data.timezone, timeZoneName: "short" } : {}),
    }).format(new Date(data.opensAt));
    return (
      <Shell theme={themeOf(data.theme)} brand={data.brand} logos={data.logos}>
        <div style={{ paddingTop: "8vh", textAlign: "center" }}>
          <span className="fk-live-lock">
            <Clock size={30} strokeWidth={1.8} aria-hidden />
          </span>
          <h1 style={{ marginTop: 22 }}>{data.title}</h1>
          <p className="fk-live-lede">{tr(langOf(data.language), "opensOn", { when })}</p>
        </div>
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
          <p className="fk-live-lede">{tr(langOf(data.language), "private")}</p>
          <input
            className="fk-live-input"
            type="password"
            autoComplete="current-password"
            aria-label={tr(langOf(data.language), "password")}
            placeholder={tr(langOf(data.language), "password")}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            style={{ marginTop: 22, borderRadius: Math.min(theme.radius, 24) }}
          />
          {data.wrong && (
            <div className="fk-live-err" role="alert">
              {tr(langOf(data.language), "wrongPassword")}
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
              {tr(langOf(data.language), "openForm")}
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  return (
    <>
      <FormRunner
        data={data as OpenForm}
        mode="live"
        resume={resume}
        onSubmit={onSubmit}
        onFollowUp={(blockId, answer) => followUp({ formId: (data as OpenForm).formId, blockId, answer })}
        onSaveForLater={(data as OpenForm).rules.partials === false ? undefined : saveForLater}
        onPay={checkout}
        onPayFirst={onPayFirst}
        onThink={(a) => think({ formId: (data as OpenForm).formId, ...a })}
        onStartQuiz={() => startQuiz({ formId: (data as OpenForm).formId, deviceId: deviceId() })}
        onStart={() => void recordView({ formId: data.formId, started: true, source: sourceLabel(), deviceId: deviceId() })}
        upload={upload}
      />
      {checking && <Turnstile tokenRef={captcha} resetRef={resetCaptcha} />}
    </>
  );
}
