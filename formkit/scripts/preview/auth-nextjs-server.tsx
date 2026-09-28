import type { ReactNode } from "react";
import { NextResponse } from "next/server";

/** Stands in for `@convex-dev/auth/nextjs/server` while `FK_PREVIEW=1`. */
export function ConvexAuthNextjsServerProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

type Handler = (request: Request, ctx: { convexAuth: { isAuthenticated: () => Promise<boolean> } }) => unknown;

/** Runs the app's own handler as signed in, so its request headers are set as in production. */
export function convexAuthNextjsMiddleware(handler: Handler) {
  return async (request: Request) =>
    (await handler(request, { convexAuth: { isAuthenticated: async () => true } })) ??
    NextResponse.next({ request: { headers: request.headers } });
}

export function createRouteMatcher() {
  return () => false;
}

export function nextjsMiddlewareRedirect() {
  return undefined;
}

export async function convexAuthNextjsToken() {
  return undefined;
}

export function isAuthenticatedNextjs() {
  return true;
}
