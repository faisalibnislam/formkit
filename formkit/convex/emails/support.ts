import { button, paragraph, quote, renderShell } from "./kit";

/** Formkit support answered: the whole answer, and the way back to the conversation. */
export function renderSupportAnswer({ subject, who, body, link }: { subject: string; who: string; body: string; link: string }) {
  return renderShell({
    eyebrow: "Formkit support",
    heading: `Re: ${subject}`,
    lede: `${who} from Formkit answered your message.`,
    body: `${quote(body.slice(0, 8000), who)}${button("Reply or read the conversation", link)}${paragraph(
      "Anyone with this link can read and reply to this conversation, so keep it to yourself.",
      { muted: true, top: 22 },
    )}`,
    reason: "Sent because you wrote to Formkit support.",
  });
}

/** A message from someone without an account: it arrived, and here is where the answer will be. */
export function renderSupportReceived({ subject, link }: { subject: string; link: string }) {
  return renderShell({
    eyebrow: "Formkit support",
    heading: "We have your message",
    lede: `A person reads every message. When we answer “${subject}”, it comes to this address.`,
    body: `${button("See the conversation", link)}${paragraph(
      "Anyone with this link can read and reply to this conversation, so keep it to yourself.",
      { muted: true, top: 22 },
    )}`,
    reason: "Sent because this address was given on formkit.app/contact.",
  });
}
