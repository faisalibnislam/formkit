import * as Sentry from "@sentry/nextjs";
import { scrub } from "@/lib/sentryScrub";

/**
 * Server-side error tracking (Sentry), on only when NEXT_PUBLIC_SENTRY_DSN
 * is set. Errors in pages and route handlers are reported through
 * onRequestError; nothing about the visitor is attached (lib/sentryScrub).
 */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0,
    beforeSend: scrub,
  });
}

export const onRequestError = Sentry.captureRequestError;
