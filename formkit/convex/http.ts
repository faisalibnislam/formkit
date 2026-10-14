import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { polarWebhook } from "./billing";
import { sheetFeed } from "./connections";
import { handle as restApi } from "./restApi";
import { handle as apiV2 } from "./apiV2";
import { registerClient, revoke, token } from "./oauth";
import { callback as integrationCallback } from "./integrations";

const http = httpRouter();

auth.addHttpRoutes(http);

// Polar tells Formkit when a subscription starts, changes or ends.
http.route({ path: "/polar/webhook", method: "POST", handler: polarWebhook });

// Google Sheets pulls a form's responses from its private link.
http.route({ pathPrefix: "/sheets/", method: "GET", handler: sheetFeed });
// Business: the read-only REST API.
http.route({ pathPrefix: "/api/v1/", method: "GET", handler: restApi });
http.route({ pathPrefix: "/api/v1/", method: "OPTIONS", handler: restApi });
// Every plan: the API scripts, Zapier and AI assistants (through /api/mcp) use.
for (const method of ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] as const) {
  http.route({ pathPrefix: "/api/v2/", method, handler: apiV2 });
}
// An app's sign-in sends people back here (integrations.ts), through formkit.app.
http.route({ path: "/integrations/callback", method: "GET", handler: integrationCallback });
// OAuth for apps that connect to the MCP server (convex/oauth.ts).
for (const method of ["POST", "OPTIONS"] as const) {
  http.route({ path: "/oauth/token", method, handler: token });
  http.route({ path: "/oauth/register", method, handler: registerClient });
  http.route({ path: "/oauth/revoke", method, handler: revoke });
}

export default http;
