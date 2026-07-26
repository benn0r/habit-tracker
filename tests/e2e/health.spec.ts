import { expect, test } from "@playwright/test";

test("health endpoint reports the running build", async ({ page }) => {
  const response = await page.goto("/api/health");

  expect(response?.ok()).toBeTruthy();
  expect(JSON.parse(await page.locator("body").innerText())).toEqual({ status: "ok", version: "e2etest" });
});
