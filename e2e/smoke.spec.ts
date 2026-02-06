import { test, expect } from "@playwright/test";

test("home redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.locator("body")).toBeVisible();
});
