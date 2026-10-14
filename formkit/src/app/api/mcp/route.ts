import { respond, Unauthorised, type ApiCall, type RpcMessage, type RpcReply } from "@/lib/mcp/server";
import { SITE_URL } from "@/lib/site";

/**
 * formkit.app/api/mcp - the MCP server AI assistants connect to. Streamable
 * HTTP, stateless: each POST is answered with JSON, there is no session and
 * no event stream. A request without a valid token is told where to sign in
 * (the protected resource metadata), which is how assistants find OAuth.
 */

const CONVEX = (process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\.convex\.cloud\/?$/, ".convex.site").replace(/\/$/, "");

const TOKEN = /^(fk_live_|fk_at_)[0-9a-f]{48}$/;

function unauthorised(message = "Connect Formkit to use its tools.") {
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message } },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${SITE_URL}/.well-known/oauth-protected-resource", scope="forms:read forms:write forms:publish responses:read"`,
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!TOKEN.test(token)) return unauthorised();

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "The body is not valid JSON." } }, { status: 400 });
  }

  const api: ApiCall = async (method, path, body) => {
    const res = await fetch(`${CONVEX}/api/v2/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  try {
    // One message, or (older clients) a batch of them.
    const messages = (Array.isArray(message) ? message : [message]) as RpcMessage[];
    const replies = (await Promise.all(messages.map((m) => respond(m, api)))).filter((r): r is RpcReply => r !== null);
    if (!replies.length) return new Response(null, { status: 202 });
    return Response.json(Array.isArray(message) ? replies : replies[0], { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof Unauthorised) return unauthorised("Formkit's sign-in has expired or was removed. Connect again.");
    throw e;
  }
}

/** No event stream: everything comes back on the POST. */
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
