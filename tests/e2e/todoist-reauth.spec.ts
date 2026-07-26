import { expect, test } from "@playwright/test";

test("expired Todoist authorization redirects sync through OAuth", async ({ context, page }) => {
  await context.addCookies([{
    name: "ritual_e2e",
    value: "1",
    url: "http://127.0.0.1:3100",
    httpOnly: true,
    sameSite: "Lax",
  }]);
  await page.route("**/api/sync", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({
      error: "Todoist authorization expired",
      code: "TODOIST_REAUTH_REQUIRED",
    }),
  }));
  await page.route("**/api/auth/login", (route) => route.fulfill({
    status: 200,
    contentType: "text/plain",
    body: "OAuth login reached",
  }));

  await page.goto("/app");
  const syncButton = page.locator("aside button.sync");
  if (!await syncButton.isVisible()) {
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  }
  await expect(syncButton).toBeVisible();
  await syncButton.click();

  await expect(page).toHaveURL("/api/auth/login");
  await expect(page.getByText("OAuth login reached")).toBeVisible();
});
