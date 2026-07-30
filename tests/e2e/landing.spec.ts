import { expect, test } from "@playwright/test";
import { authenticate } from "./support";

test("landing page presents the Todoist habit workflow", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Habit Tracker — habits, honestly");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your habits");
  await expect(page.getByRole("link", { name: "Continue with Todoist" })).toHaveAttribute("href", "/api/auth/login");
  await expect(page.locator(".nav .brand-logo")).toHaveAttribute("src", "/icons/favicon-rounded-192.png");
  await expect(page.locator(".preview .heatmap i")).toHaveCount(63);
  await expect(page.locator("main.landing > footer.site-footer")).toBeVisible();
  await expect(page.locator("body > footer.site-footer")).toHaveCount(0);
  await expect(page.locator(".site-footer")).toContainText("Habit Tracker · build");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
});

test("landing page does not overflow its viewport", async ({ page }) => {
  await page.goto("/");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("redirects an authenticated visitor from the home page to the app", async ({ context, page }) => {
  await authenticate(context);

  await page.goto("/");

  await expect(page).toHaveURL((url) => url.pathname === "/app");
  await expect(page.getByRole("heading", { name: "Your dashboard" })).toBeVisible();
});
