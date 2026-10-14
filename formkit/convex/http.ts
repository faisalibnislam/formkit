import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { polarWebhook } from "./billing";
import { sheetFeed } from "./connections";
import { handle as restApi } from "./restApi";
import { handle as apiV2 } from "./apiV2";

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
for (const method of ["GET", "POST", "PATCH", "OPTIONS"] as const) {
  http.route({ pathPrefix: "/api/v2/", method, handler: apiV2 });
}

export default http;
