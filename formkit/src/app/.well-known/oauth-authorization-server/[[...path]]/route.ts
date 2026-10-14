import { META_HEADERS, authorizationServer } from "@/lib/mcp/oauthMeta";

/** RFC 8414. Assistants that look for OpenID's address are answered at /.well-known/openid-configuration too. */
export function GET() {
  return Response.json(authorizationServer(), { headers: META_HEADERS });
}
