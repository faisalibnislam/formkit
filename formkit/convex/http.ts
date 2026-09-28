import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { polarWebhook } from "./billing";
import { sheetFeed } from "./connections";

const http = httpRouter();

auth.addHttpRoutes(http);

// Polar tells Formkit when a subscription starts, changes or ends.
http.route({ path: "/polar/webhook", method: "POST", handler: polarWebhook });

// Google Sheets pulls a form's responses from its private link.
http.route({ pathPrefix: "/sheets/", method: "GET", handler: sheetFeed });

export default http;
