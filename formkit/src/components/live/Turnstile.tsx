"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile, the spam check on live forms. It only shows itself
 * when Cloudflare wants an interaction ("interaction-only"); otherwise it
 * runs unseen and hands back a token, which the form trades for a one-time
 * pass just before sending (publicForm.verifyHuman). If the script cannot
 * load (blocked, offline), nothing breaks: the form falls back to asking the
 * person to tick a box.
 */

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi | null> | null = null;

function load(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve(window.turnstile ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loading;
}

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * Renders the widget and keeps `tokenRef` holding the latest token (null
 * while there is none). `resetRef` gets a function that asks for a fresh one,
 * since each token can be used once.
 */
export function Turnstile({
  tokenRef,
  resetRef,
}: {
  tokenRef: { current: string | null };
  resetRef: { current: () => void };
}) {
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let id: string | null = null;
    let api: TurnstileApi | null = null;
    let live = true;
    void load().then((t) => {
      if (!live || !t || !box.current) return;
      api = t;
      id = t.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        callback: (token: string) => {
          tokenRef.current = token;
        },
        "expired-callback": () => {
          tokenRef.current = null;
        },
        "error-callback": () => {
          tokenRef.current = null;
        },
      });
      resetRef.current = () => {
        tokenRef.current = null;
        if (api && id) api.reset(id);
      };
    });
    return () => {
      live = false;
      if (api && id) api.remove(id);
    };
  }, [tokenRef, resetRef]);

  return <div ref={box} className="fk-live-turnstile" />;
}
