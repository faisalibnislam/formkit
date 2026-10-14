import * as Sentry from "@sentry/nextjs";
import { scrub } from "@/lib/sentryScrub";

/**
 * Browser error tracking (Sentry), on only when NEXT_PUBLIC_SENTRY_DSN is
 * set: uncaught errors, and what the error pages catch (lib/reportError).
 * No performance tracing, no session replay, nothing about the visitor.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0,
    beforeSend: scrub,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
