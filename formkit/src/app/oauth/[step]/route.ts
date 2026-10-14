/**
 * formkit.app/oauth/token, /register and /revoke. The work is done by the
 * Convex deployment's HTTP routes (convex/oauth.ts); this passes requests
 * through, with the caller's address for rate limits.
 */
const CONVEX = (process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\.convex\.cloud\/?$/, ".convex.site").replace(/\/$/, "");
const STEPS = new Set(["token", "register", "revoke"]);

async function pass(request: Request, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!STEPS.has(step)) return new Response(null, { status: 404 });
  const res = await fetch(`${CONVEX}/oauth/${step}`, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/x-www-form-urlencoded",
      "x-formkit-ip": (request.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim(),
    },
    body: request.method === "POST" ? await request.text() : undefined,
    cache: "no-store",
  });
  return new Response(res.status === 204 ? null : res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST",
    },
  });
}

export const POST = pass;
export const OPTIONS = pass;
