import { test, expect } from "@playwright/test";

test("home loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);

  // smoke check mínimo (ajuste o texto quando você trocar a home)
  await expect(page.locator("body")).toBeVisible();
});
