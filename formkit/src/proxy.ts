import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../convex/_generated/api";
import { isOwnHost } from "@/lib/site";

/**
 * Route protection.
 *
 * Next.js 16 renamed the `middleware` convention to `proxy`; the named export
 * must be `proxy`, and the runtime is Node, not Edge.
 *
 * formkit.app/admin is unlinked and gated by who you are: staff get the
 * console, a signed-in customer is sent to their dashboard, and a stranger to
 * the marketing site. The customer-versus-staff half of that is decided inside
 * the admin route itself, since only Convex knows the staff role - here we only
 * keep signed-out visitors away from anything authenticated.
 */
const isSignedInOnly = createRouteMatcher(["/app(.*)", "/admin(.*)", "/onboarding(.*)"]);
const isAuthPage = createRouteMatcher(["/signin", "/signup"]);

/**
 * `/app?view=…` is how links into auth and onboarding are written - from
 * emails and the marketing site - so each lands on its own page.
 */
const VIEWS: Record<string, string> = {
  signin: "/signin",
  signup: "/signup",
  forgot: "/signin?view=forgot",
  setup: "/onboarding",
};

/* ---------- Custom domains (Pro) ----------

   A request to a host that is not Formkit's own is a customer's domain.
   forms.acme.com/<slug> shows that identity's form at <slug>; the root
   lists its open forms; resume links work as they are; anything else goes
   to formkit.app. When the owner's plan no longer has custom domains, every
   request is sent on to their formkit.app link so nothing shared breaks. */

const MAIN = process.env.NEXT_PUBLIC_SITE_URL ?? "https://formkit.app";

type Resolved = { handle: string; live: boolean } | null;
const seen = new Map<string, { at: number; value: Resolved }>();
const TTL = 60_000;

async function resolveHost(host: string): Promise<Resolved> {
  const hit = seen.get(host);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  let value: Resolved = null;
  try {
    value = await fetchQuery(api.domains.resolve, { host });
  } catch {
    value = hit?.value ?? null;
  }
  seen.set(host, { at: Date.now(), value });
  return value;
}



async function customDomain(request: NextRequest) {
  const host = (request.headers.get("host") ?? request.nextUrl.host).split(":")[0]!.toLowerCase();
  if (isOwnHost(host)) return null;
  const path = request.nextUrl.pathname;
  // Formkit's domain check asks for this to be sure it is Formkit answering,
  // not another site on Vercel that also claims the name.
  if (path === "/api/formkit-domain") {
    return new NextResponse("formkit", { headers: { "x-formkit": "1", "cache-control": "no-store" } });
  }
  const found = await resolveHost(host);
  if (!found) return NextResponse.redirect(new URL(MAIN));
  if (!found.live) {
    return NextResponse.redirect(new URL(`/${found.handle}${path === "/" ? "" : path}`, MAIN));
  }
  if (path === "/") return NextResponse.rewrite(new URL(`/domain/${host}`, request.url));
  if (path.startsWith("/r/") || path.startsWith("/q/")) return NextResponse.next();
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 1) return NextResponse.rewrite(new URL(`/${found.handle}/${parts[0]}${request.nextUrl.search}`, request.url));
  return NextResponse.redirect(new URL(path, MAIN));
}

export const proxy = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const custom = await customDomain(request);
  if (custom) return custom;

  // The app layout reads this to fetch the page's first data on the server
  // (src/lib/seedServer.ts). The auth middleware passes these headers on.
  request.headers.set("x-fk-path", request.nextUrl.pathname);

  const view = request.nextUrl.searchParams.get("view");
  if (view && VIEWS[view] && request.nextUrl.pathname.startsWith("/app")) {
    return nextjsMiddlewareRedirect(request, VIEWS[view]);
  }

  // Asking Convex costs a round trip, so only where the answer matters. The
  // marketing pages are static and find out in the browser (SiteSession).
  const gated = isSignedInOnly(request);
  const authPage = isAuthPage(request);
  if (!gated && !authPage) return;
  const authed = await convexAuth.isAuthenticated();

  if (gated && !authed) {
    const next = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    return nextjsMiddlewareRedirect(request, `/signin?next=${next}`);
  }

  if (authPage && authed) {
    return nextjsMiddlewareRedirect(request, "/app");
  }
});

export default proxy;

export const config = {
  // Everything except Next's own assets and the files served from /public.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
