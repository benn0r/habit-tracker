import { expect, test } from "@playwright/test";

test("customizes and resets a habit label", async ({ context, page }) => {
  await context.addCookies([{
    name: "ritual_e2e", value: "1", url: "http://127.0.0.1:3100",
    httpOnly: true, sameSite: "Lax",
  }]);

  let labelOverride: string | null = null;
  let trackingStartDate: string | null = null;
  await page.route("**/api/dashboard", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      user: { name: "Fantasy Athlete", email: "athlete@example.test" },
      habits: [{
        task_id: "sport-1", content: "Sport", label_override: labelOverride,
        todoist_recurrence: "every week", override_type: null, override_count: null,
        override_period: null, tracking_start_date: trackingStartDate, project_name: "Training", color: "#ff6b57",
      }],
      completions: [],
    }),
  }));
  await page.route("**/api/habits/sport-1", async (route) => {
    const body = route.request().postDataJSON() as { label?: string; trackingStartDate?: string };
    if (Object.hasOwn(body, "label")) labelOverride = body.label?.trim() || null;
    if (Object.hasOwn(body, "trackingStartDate")) trackingStartDate = body.trackingStartDate || null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/app?habit=sport-1");
  await expect(page.locator("aside .brand-logo")).toHaveAttribute("src", "/icons/favicon-rounded-192.png");
  await page.getByRole("button", { name: "Habit settings" }).click();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await expect(page.getByText("Rhythm", { exact: true })).toBeVisible();
  await page.getByLabel("Tracking start date").fill("2026-08-10");
  await page.getByRole("button", { name: "Save date" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.getByLabel("Habit label").fill("Training session");
  await page.getByRole("button", { name: "Save label" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.getByRole("heading", { name: "Training session" })).toBeVisible();

  await page.getByRole("button", { name: "Habit settings" }).click();
  await page.getByLabel("Habit label").fill("");
  await page.getByRole("button", { name: "Save label" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.getByRole("heading", { name: "Sport" })).toBeVisible();
});
