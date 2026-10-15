/**
 * formkit.app/api/agent/forms/{slug} - forms an AI agent can read and fill in
 * for someone, when the owner allows it. The work is done by the Convex
 * deployment (convex/agents.ts); this passes requests through with the
 * caller's address, which the per-caller limit counts against.
 */
const SITE = (process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(
  /\.convex\.cloud\/?$/,
  ".convex.site",
);

async function pass(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hasBody = request.method === "POST";
  const caller = (request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim();
  const res = await fetch(`${SITE.replace(/\/$/, "")}/agent/forms/${encodeURIComponent(slug)}`, {
    method: request.method,
    headers: {
      ...(caller ? { "X-Forwarded-For": caller } : {}),
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? await request.text() : undefined,
    cache: "no-store",
  });
  const headers = new Headers({
    "Content-Type": res.headers.get("content-type") ?? "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  return new Response(res.status === 204 ? null : res.body, { status: res.status, headers });
}

export const GET = pass;
export const POST = pass;
export const OPTIONS = pass;
