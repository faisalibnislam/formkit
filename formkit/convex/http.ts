import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { polarWebhook } from "./billing";

const http = httpRouter();

auth.addHttpRoutes(http);

// Polar tells Formkit when a subscription starts, changes or ends.
http.route({ path: "/polar/webhook", method: "POST", handler: polarWebhook });

export default http;
