import { META_HEADERS, protectedResource } from "@/lib/mcp/oauthMeta";

/** RFC 9728, at the root and at /.well-known/oauth-protected-resource/api/mcp. */
export function GET() {
  return Response.json(protectedResource(), { headers: META_HEADERS });
}
