import { conditionsOf, type Rule } from "./logicEval";

/**
 * Where "Next" goes, for the live form and the builder's tester alike.
 *
 * A "jump to" rule names a question or a page break. Jumping ahead works as
 * it always has: from any earlier page, once the rule matches. Jumping back
 * is decided only on the page of the last question the rule reads, so the
 * person is sent round again from there and can change that answer. If they
 * don't, the same jump would send them round for ever, so each jump back is
 * taken at most MAX_ROUNDS times; after that the form simply moves on.
 *
 * A jump can also go to an ending (`endingId`, with no target): the form is
 * sent there and then, once the page holding its last question is done.
 * "default" is the usual thank-you screen.
 */

export const MAX_ROUNDS = 5;

export type JumpPage = {
  /** Every block that leads here: its page break, its questions (shown or not). */
  anchors: string[];
};

/** The page a block belongs to, or -1. */
export function pageHolding(pages: JumpPage[], id: string | null | undefined): number {
  if (!id) return -1;
  return pages.findIndex((p) => p.anchors.includes(id));
}

/** The page a rule's last question sits on: where a jump back is decided. */
export function homePage(pages: JumpPage[], rule: Rule): number {
  return Math.max(-1, ...conditionsOf(rule).map((c) => (c.source !== "calc" ? pageHolding(pages, c.blockId) : -1)));
}

export type Move = {
  to: number;
  /** Set when a jump back was taken, so its rounds can be counted. */
  back?: string;
  /** Set when a jump goes to an ending: send the form now, ending there. */
  finish?: string;
};

/** The ending a "finish now" jump names, or undefined for the usual thank-you screen. */
export const endingOf = (finish: string) => (finish === "default" ? undefined : finish);

/**
 * Where "Next" goes from page `at`, given the jump rules that match now (in
 * rule order) and how often each jump back has been taken already.
 */
export function nextPage(pages: JumpPage[], at: number, matching: Rule[], rounds: Record<string, number> = {}): Move {
  for (const rule of matching) {
    if (rule.action !== "jump" || rule.enabled === false) continue;
    if (!rule.targetId && rule.endingId) {
      if (at >= homePage(pages, rule)) return { to: pages.length, finish: rule.endingId };
      continue;
    }
    const to = pageHolding(pages, rule.targetId);
    if (to < 0 || to === at) continue;
    if (to > at) return { to };
    const key = rule._id ?? rule.targetId ?? "";
    if (homePage(pages, rule) !== at || (rounds[key] ?? 0) >= MAX_ROUNDS) continue;
    return { to, back: key };
  }
  return { to: at + 1 };
}
