import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** No serious or critical accessibility problems on the page as it stands. */
export async function expectAccessible(page: Page, opts: { include?: string; exclude?: string } = {}) {
  let axe = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (opts.include) axe = axe.include(opts.include);
  if (opts.exclude) axe = axe.exclude(opts.exclude);
  const { violations } = await axe.analyze();
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}
