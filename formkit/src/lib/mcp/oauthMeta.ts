import { SITE_URL } from "@/lib/site";
import { SCOPES } from "../../../convex/model/apiAuth";

/**
 * What an AI assistant reads to find out how to connect to Formkit: the MCP
 * server is a protected resource (RFC 9728), and formkit.app is its
 * authorisation server (RFC 8414). The work is in convex/oauth.ts.
 */

export const MCP_URL = `${SITE_URL}/api/mcp`;

export function protectedResource() {
  return {
    resource: MCP_URL,
    authorization_servers: [SITE_URL],
    scopes_supported: SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Formkit",
    resource_documentation: `${SITE_URL}/api-docs`,
  };
}

export function authorizationServer() {
  return {
    issuer: SITE_URL,
    authorization_endpoint: `${SITE_URL}/oauth/authorize`,
    token_endpoint: `${SITE_URL}/oauth/token`,
    registration_endpoint: `${SITE_URL}/oauth/register`,
    revocation_endpoint: `${SITE_URL}/oauth/revoke`,
    scopes_supported: SCOPES,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${SITE_URL}/api-docs`,
  };
}

export const META_HEADERS = { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" };
