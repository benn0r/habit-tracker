import { expect, test } from "@playwright/test";
import { authenticate } from "./support";

test("automatically syncs when the previous app visit was more than four hours ago", async ({ context, page }) => {
  await authenticate(context);
  await page.addInitScript(() => {
    localStorage.setItem("habit-tracker:last-app-visit", String(Date.now() - 4 * 60 * 60 * 1000 - 1));
  });
  let syncRequests = 0;
  await page.route("**/api/sync", (route) => {
    syncRequests++;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/app");

  await expect.poll(() => syncRequests).toBe(1);
  await expect(page.getByRole("heading", { name: "Your dashboard" })).toBeVisible();
});

test("does not automatically sync after a recent app visit", async ({ context, page }) => {
  await authenticate(context);
  await page.addInitScript(() => {
    localStorage.setItem("habit-tracker:last-app-visit", String(Date.now() - 60 * 60 * 1000));
  });
  let syncRequests = 0;
  await page.route("**/api/sync", (route) => {
    syncRequests++;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Your dashboard" })).toBeVisible();

  expect(syncRequests).toBe(0);
});
