import * as Sentry from "@sentry/nextjs";

/**
 * Where caught errors go: Sentry when NEXT_PUBLIC_SENTRY_DSN is set (see
 * instrumentation-client.ts), and the console always.
 */
export function reportError(error: unknown) {
  console.error(error);
  Sentry.captureException(error);
}
