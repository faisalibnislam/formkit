import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

const FORM = "/studio-nine/client-onboarding";

test("a published form can be answered with the keyboard, and is accessible", async ({ page }) => {
  await page.goto(FORM);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectAccessible(page);
  const start = page.getByRole("button", { name: /start/i });
  if (await start.isVisible().catch(() => false)) await start.click();
  const first = page.getByRole("textbox").first();
  await first.focus();
  await page.keyboard.type("Sam Taylor");
  await expect(first).toHaveValue("Sam Taylor");
  await expectAccessible(page);
});

test("a required question stops the form, and says so", async ({ page }) => {
  await page.goto(FORM);
  const start = page.getByRole("button", { name: /start/i });
  if (await start.isVisible().catch(() => false)) await start.click();
  await page.getByRole("button", { name: /^(next|submit|ok)$/i }).first().click();
  await expect(page.getByText(/needed before you can go on/i).first()).toBeVisible();
});

test("a form offered in Spanish speaks Spanish for ?lang=es", async ({ page }) => {
  await page.goto(`${FORM}?fk_lang=1&lang=es`);
  await expect(page.getByText("Empecemos tu proyecto")).toBeVisible();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeVisible();
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Idioma" })).toHaveValue("es");
  await page.getByRole("combobox", { name: "Idioma" }).selectOption("en");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeVisible();
});
