import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

/**
 * Route protection.
 *
 * Next.js 16 renamed the `middleware` convention to `proxy`; the named export
 * must be `proxy`, and the runtime is Node, not Edge.
 *
 * formkit.app/admin is unlinked and gated by who you are: staff get the
 * console, a signed-in customer is sent to their dashboard, and a stranger to
 * the marketing site. The customer-versus-staff half of that is decided inside
 * the admin route itself, since only Convex knows the staff role — here we only
 * keep signed-out visitors away from anything authenticated.
 */
const isSignedInOnly = createRouteMatcher(["/app(.*)", "/admin(.*)", "/onboarding(.*)"]);
const isAuthPage = createRouteMatcher(["/signin", "/signup"]);

export const proxy = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authed = await convexAuth.isAuthenticated();

  if (isSignedInOnly(request) && !authed) {
    const next = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    return nextjsMiddlewareRedirect(request, `/signin?next=${next}`);
  }

  if (isAuthPage(request) && authed) {
    return nextjsMiddlewareRedirect(request, "/app");
  }
});

export default proxy;

export const config = {
  // Everything except Next's own assets and the files served from /public.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
