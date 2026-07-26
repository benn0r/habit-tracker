import { expect, test } from "@playwright/test";

test("landing page presents the Todoist habit workflow", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Habit Tracker — habits, honestly");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your habits");
  await expect(page.getByRole("link", { name: "Continue with Todoist" })).toHaveAttribute("href", "/api/auth/login");
  await expect(page.locator(".preview .heatmap i")).toHaveCount(63);
  await expect(page.locator(".site-footer")).toContainText("Habit Tracker · build");
});

test("landing page does not overflow its viewport", async ({ page }) => {
  await page.goto("/");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
