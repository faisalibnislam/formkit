/**
 * formkit.app/api/v1/… — the Business REST API. The work is done by the
 * Convex deployment's HTTP routes (convex/restApi.ts); this passes requests
 * through so the API has Formkit's own address.
 */
const SITE = (process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(
  /\.convex\.cloud\/?$/,
  ".convex.site",
);

async function pass(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = new URL(request.url);
  const target = `${SITE.replace(/\/$/, "")}/api/v1/${path.map(encodeURIComponent).join("/")}${url.search}`;
  const res = await fetch(target, {
    method: request.method,
    headers: { Authorization: request.headers.get("authorization") ?? "" },
    cache: "no-store",
  });
  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const GET = pass;
export const OPTIONS = pass;
