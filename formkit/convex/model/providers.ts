/**
 * The apps a form can send its responses into over OAuth: where each one
 * signs people in, what it asks for (as little as it can), and how its token
 * request is made. Each needs its own app registered by Formkit, with the
 * client id and secret in the Convex deployment's environment; until then it
 * is not offered.
 */

export type ProviderId = "google" | "notion" | "airtable" | "hubspot";

export type Provider = {
  label: string;
  /** The connection kind it makes on a form. */
  kind: "gsheets" | "notion" | "airtable" | "hubspot";
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Airtable and Google take PKCE; Airtable insists on it. */
  pkce: boolean;
  /** How the client id and secret go with the token request. */
  tokenAuth: "body" | "basic";
  /** Notion's token endpoint takes JSON; the others a form body. */
  tokenJson?: boolean;
  env: [string, string];
  authParams?: Record<string, string>;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  google: {
    label: "Google Sheets",
    kind: "gsheets",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    // Only the files Formkit makes, never the rest of their Drive.
    scopes: ["https://www.googleapis.com/auth/drive.file", "openid", "email"],
    pkce: true,
    tokenAuth: "body",
    env: ["GOOGLE_INTEGRATION_CLIENT_ID", "GOOGLE_INTEGRATION_CLIENT_SECRET"],
    authParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  notion: {
    label: "Notion",
    kind: "notion",
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    pkce: false,
    tokenAuth: "basic",
    tokenJson: true,
    env: ["NOTION_CLIENT_ID", "NOTION_CLIENT_SECRET"],
    authParams: { owner: "user" },
  },
  airtable: {
    label: "Airtable",
    kind: "airtable",
    authUrl: "https://airtable.com/oauth2/v1/authorize",
    tokenUrl: "https://airtable.com/oauth2/v1/token",
    scopes: ["data.records:write", "schema.bases:read", "schema.bases:write"],
    pkce: true,
    tokenAuth: "basic",
    env: ["AIRTABLE_CLIENT_ID", "AIRTABLE_CLIENT_SECRET"],
  },
  hubspot: {
    label: "HubSpot",
    kind: "hubspot",
    authUrl: "https://app.hubspot.com/oauth/authorize",
    tokenUrl: "https://api.hubapi.com/oauth/v1/token",
    scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"],
    pkce: false,
    tokenAuth: "body",
    env: ["HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET"],
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function credentials(p: ProviderId) {
  const [idVar, secretVar] = PROVIDERS[p].env;
  const id = process.env[idVar];
  const secret = process.env[secretVar];
  return id && secret ? { id, secret } : null;
}

/** The connection kinds that push to an app over OAuth. */
export const APP_KINDS = new Set(["gsheets", "notion", "airtable", "hubspot"]);

export function providerOfKind(kind: string): ProviderId | null {
  return (PROVIDER_IDS.find((p) => PROVIDERS[p].kind === kind) as ProviderId | undefined) ?? null;
}
