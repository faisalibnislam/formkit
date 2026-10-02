"use client";

import { ConvexProviderWithAuth, useConvexAuth } from "convex/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { convex } from "@/lib/convexClient";
import { clearViewerHint } from "@/lib/viewerHint";
import { HINT_KEY } from "@/lib/viewerHintScript";

const CHECKED = "fk_session_checked";

/**
 * Convex for the static marketing pages.
 *
 * The app's pages get their sign-in token from the server as each page is
 * rendered. These pages are the same HTML for everyone, so instead the
 * browser asks /api/session for it once the page is up. That endpoint reads
 * the same httpOnly session cookie (refreshed by the middleware on the way
 * in), so the nav, the help pages and the support form see exactly who is
 * signed in, as before.
 *
 * `state` says whether that answer has arrived. Until it has, a query that
 * comes back empty means "not asked yet", not "signed out".
 *
 * Most visitors are not signed in, so the check is skipped for a browser that
 * has no remembered viewer and has already been checked once this session:
 * no request at all for them. Anyone signed in has the note, or gets it the
 * first time they are checked.
 */

type SessionState = "checking" | "in" | "out";
const SessionContext = createContext<SessionState | null>(null);

/** "checking", "in" or "out" on a marketing page; null inside the app. */
export function useSiteSession() {
  return useContext(SessionContext);
}

async function sessionToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return null;
    const { token } = (await res.json()) as { token: string | null };
    return token ?? null;
  } catch {
    return null;
  }
}

/** What the browser has learned from /api/session so far. */
type Found = { loading: boolean; token: string | null };
const FoundContext = createContext<Found>({ loading: true, token: null });

/** The `useAuth` Convex asks for: the token found, and a fresh one when it asks again. */
function useSiteAuth() {
  const { loading, token } = useContext(FoundContext);
  const fetchAccessToken = useCallback(
    // Asked again (forced) shortly before the token expires; the middleware
    // has refreshed the cookie by the time the endpoint reads it.
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => (forceRefreshToken ? sessionToken() : token),
    [token],
  );
  return useMemo(
    () => ({ isLoading: loading, isAuthenticated: token !== null, fetchAccessToken }),
    [loading, token, fetchAccessToken],
  );
}

export function SiteSession({ children }: { children: ReactNode }) {
  // Starts unknown on the server and in the first browser render alike.
  const [found, setFound] = useState<Found>({ loading: true, token: null });

  useEffect(() => {
    let remembered = false;
    let checked = false;
    try {
      remembered = window.localStorage.getItem(HINT_KEY) !== null;
      checked = window.sessionStorage.getItem(CHECKED) !== null;
      window.sessionStorage.setItem(CHECKED, "1");
    } catch {
      /* storage blocked: check every time */
    }
    let live = true;
    if (!remembered && checked) {
      const t = setTimeout(() => setFound({ loading: false, token: null }), 0);
      return () => clearTimeout(t);
    }
    void sessionToken().then((token) => {
      if (live) setFound({ loading: false, token });
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <FoundContext.Provider value={found}>
      <ConvexProviderWithAuth client={convex} useAuth={useSiteAuth}>
        <SessionBridge>{children}</SessionBridge>
      </ConvexProviderWithAuth>
    </FoundContext.Provider>
  );
}

/** Signed in once Convex has accepted the token; forgets the remembered viewer when not. */
function SessionBridge({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const state: SessionState = isLoading ? "checking" : isAuthenticated ? "in" : "out";
  useEffect(() => {
    if (state === "out") clearViewerHint();
  }, [state]);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
