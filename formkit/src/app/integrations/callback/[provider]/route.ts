/**
 * formkit.app/integrations/callback/{provider}: where Google, Notion,
 * Airtable and HubSpot send someone back after they allow Formkit in. The
 * Convex deployment (convex/integrations.ts) swaps the code for tokens and
 * says where to go next.
 */
const CONVEX = (process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\.convex\.cloud\/?$/, ".convex.site").replace(/\/$/, "");

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  url.searchParams.set("provider", provider);
  const res = await fetch(`${CONVEX}/integrations/callback?${url.searchParams}`, { redirect: "manual", cache: "no-store" });
  const to = res.headers.get("location");
  return to ? Response.redirect(to, 302) : new Response("That did not work. Close this tab and try again from Formkit.", { status: 400 });
}
