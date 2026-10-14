import { SITE_URL } from "@/lib/site";

/**
 * The authorisation endpoint. The consent screen lives in the app (it needs
 * the person signed in), so this hands the request on to it unchanged.
 */
export function GET(request: Request) {
  const url = new URL(request.url);
  return Response.redirect(`${SITE_URL}/connect${url.search}`, 302);
}
