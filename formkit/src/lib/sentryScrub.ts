import type { ErrorEvent } from "@sentry/nextjs";

/**
 * What error reports may say about where they came from. Links that carry a
 * secret (a respondent's resume link, a collaborator's invite, quiz
 * results) lose the token, and every URL loses its query string, which can
 * hold prefilled answers. No user details are attached anywhere.
 */
const SECRET_PATHS = /\/(r|j|q)\/[^/?#]+/g;

export function scrubUrl(url: string) {
  return url.replace(/[?#].*$/, "").replace(SECRET_PATHS, "/$1/[token]");
}

export function scrub(event: ErrorEvent): ErrorEvent {
  if (event.request?.url) event.request.url = scrubUrl(event.request.url);
  if (event.request) {
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.data;
  }
  for (const b of event.breadcrumbs ?? []) {
    if (typeof b.data?.url === "string") b.data.url = scrubUrl(b.data.url);
    if (typeof b.data?.to === "string") b.data.to = scrubUrl(b.data.to);
    if (typeof b.data?.from === "string") b.data.from = scrubUrl(b.data.from);
  }
  delete event.user;
  return event;
}
