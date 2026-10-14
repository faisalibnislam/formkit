/**
 * Where caught errors go. Logged to the console until error tracking is
 * connected (NEXT_PUBLIC_SENTRY_DSN); then this is the one place that
 * forwards them.
 */
export function reportError(error: unknown) {
  console.error(error);
}
