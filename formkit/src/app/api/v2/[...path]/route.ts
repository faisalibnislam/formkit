/**
 * formkit.app/api/v2/… - the API every plan has. The work is done by the
 * Convex deployment's HTTP routes (convex/apiV2.ts); this passes requests
 * through so the API has Formkit's own address.
 */
const SITE = (process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(
  /\.convex\.cloud\/?$/,
  ".convex.site",
);

async function pass(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = new URL(request.url);
  const target = `${SITE.replace(/\/$/, "")}/api/v2/${path.map(encodeURIComponent).join("/")}${url.search}`;
  const hasBody = request.method === "POST" || request.method === "PATCH";
  const res = await fetch(target, {
    method: request.method,
    headers: {
      Authorization: request.headers.get("authorization") ?? "",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? await request.text() : undefined,
    cache: "no-store",
  });
  const headers = new Headers({
    "Content-Type": res.headers.get("content-type") ?? "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  for (const h of ["www-authenticate", "access-control-allow-headers", "access-control-allow-methods"]) {
    const v = res.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(res.status === 204 ? null : res.body, { status: res.status, headers });
}

export const GET = pass;
export const POST = pass;
export const PATCH = pass;
export const DELETE = pass;
export const OPTIONS = pass;
