import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

test("the home page is accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  // The hero's words sit on the animated sky, which axe cannot see (it reads
  // the page's own pale background), so they are checked by eye instead.
  await expectAccessible(page, { exclude: ".fk-hero-eyebrow, .fk-hero-sub" });
});

test("the inbox filters by the company's own statuses, and they can be changed", async ({ page }) => {
  await page.goto("/app/responses");
  await expect(page.getByRole("heading", { name: "Responses" })).toBeVisible();
  const status = page.getByRole("combobox", { name: "Status" }).or(page.getByRole("button", { name: "Status" })).first();
  await status.click();
  await expect(page.getByRole("option", { name: "Waiting on them" })).toBeVisible();
  await page.getByRole("option", { name: "Change statuses…" }).click();
  await expect(page.getByRole("dialog", { name: "Response statuses" })).toBeVisible();
  await expectAccessible(page, { include: "[role=dialog]" });
});

test("the builder lists its keyboard shortcuts on ?", async ({ page }) => {
  await page.goto("/app/forms/f1");
  await expect(page.locator("[data-block-id]").first()).toBeVisible({ timeout: 45_000 });
  // The questions are server-rendered; Undo appears once the page is live.
  await expect(page.getByRole("button", { name: /^Undo: / })).toBeVisible({ timeout: 45_000 });
  await page.locator("body").press("Shift+Slash");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
});

test("Settings → Developers shows the AI assistant address and connected apps", async ({ page }) => {
  await page.goto("/app/settings?tab=developers");
  await expect(page.getByText(/api\/mcp/).first()).toBeVisible();
  await expect(page.getByText("Claude", { exact: true })).toBeVisible();
  await expectAccessible(page, { include: "main" });
});

test("Settings → Notifications offers push for each device, and lists them", async ({ page }) => {
  await page.goto("/app/settings?tab=notifications");
  await expect(page.getByRole("heading", { name: "Push notifications" })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("switch", { name: "Push notifications on this device" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Signed-up devices" }).getByText("Safari on iOS")).toBeVisible();
  await expectAccessible(page, { include: "main" });
});
