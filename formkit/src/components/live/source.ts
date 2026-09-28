/**
 * Where a respondent came from, named the way the owner thinks about it -
 * "Direct link", "Instagram", "Embedded on acme.com" - rather than as a raw
 * referrer URL. Read once, in the browser, and sent with the view, the start
 * and the response alike so Analytics can line them up.
 */

const KNOWN: [RegExp, string][] = [
  [/(^|\.)google\./, "Google search"],
  [/(^|\.)bing\.com$/, "Bing search"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)(instagram\.com|l\.instagram\.com)$/, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.me|l\.facebook\.com)$/, "Facebook"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com)$/, "Email"],
  [/(^|\.)(slack\.com|slack-redir\.net)$/, "Slack"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "WhatsApp"],
];

function titled(value: string) {
  const v = value.replace(/[-_+]+/g, " ").trim();
  return v ? v[0]!.toUpperCase() + v.slice(1) : v;
}

export function sourceLabel(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const src = params.get("src");
  if (src === "qr") return "QR code";
  const medium = (params.get("utm_medium") ?? "").toLowerCase();
  const tagged = params.get("utm_source") ?? params.get("ref") ?? src;
  if (medium === "email" || medium === "newsletter") return tagged ? `Email · ${titled(tagged)}` : "Email";
  if (tagged) return titled(tagged).slice(0, 60);

  let host = "";
  try {
    host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
  } catch {
    host = "";
  }
  let framed = false;
  try {
    framed = window.self !== window.top;
  } catch {
    framed = true;
  }
  if (framed) return host ? `Embedded on ${host}` : "Embedded";
  if (!host || host === window.location.hostname) return "Direct link";
  for (const [pattern, name] of KNOWN) if (pattern.test(host)) return name;
  return host;
}
