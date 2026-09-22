import type { ReactNode } from "react";

/** Stands in for `@convex-dev/auth/nextjs/server` while `FK_PREVIEW=1`. */
export function ConvexAuthNextjsServerProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function convexAuthNextjsMiddleware(handler: unknown) {
  void handler;
  return () => undefined;
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
