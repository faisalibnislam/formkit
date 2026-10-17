import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "Formkit integrations";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return ogImage({ kicker: "Integrations", title: "Every response, in the tools you use", sub: "Sheets, Notion, Airtable, HubSpot, Slack and more." });
}
