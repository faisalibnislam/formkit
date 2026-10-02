import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

/**
 * The signed-in visitor's Convex token, for the static marketing pages
 * (src/components/site/SiteSession.tsx). It is what the app's pages already
 * put in their HTML for the browser, read from the same httpOnly cookie,
 * which the middleware refreshes on the way in. Never cached, and only
 * readable from Formkit's own pages (no CORS headers).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let token: string | null = null;
  try {
    token = (await convexAuthNextjsToken()) ?? null;
  } catch {
    token = null;
  }
  return Response.json({ token }, { headers: { "Cache-Control": "private, no-store" } });
}
