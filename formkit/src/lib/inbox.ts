/**
 * The responses inbox's first request, shared by the page (which asks for
 * it) and the app layout (which fetches it before the page paints, see
 * src/lib/seed.tsx). Keys in this order: the seed is matched on them.
 */
export const INBOX_PAGE = 50;
export const FIRST_ROWS = { kind: "all", order: "desc", limit: INBOX_PAGE } as const;
