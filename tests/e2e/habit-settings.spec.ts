import { expect, test } from "@playwright/test";
import { authenticate } from "./support";

test("customizes and resets a habit label", async ({ context, page }) => {
  await authenticate(context);

  let labelOverride: string | null = null;
  let trackingStartDate: string | null = null;
  const patches: Record<string, unknown>[] = [];
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: "Fantasy Athlete", email: "athlete@example.test" },
        habits: [
          {
            task_id: "sport-1",
            content: "Sport",
            label_override: labelOverride,
            todoist_recurrence: "every week",
            override_type: null,
            override_count: null,
            override_period: null,
            tracking_start_date: trackingStartDate,
            project_name: "Training",
            color: "#ff6b57",
          },
        ],
        completions: [],
      }),
    }),
  );
  await page.route("**/api/habits/sport-1", async (route) => {
    expect(route.request().method()).toBe("PATCH");
    const body = route.request().postDataJSON() as { label?: string; trackingStartDate?: string };
    patches.push(body);
    if (Object.hasOwn(body, "label")) labelOverride = body.label?.trim() || null;
    if (Object.hasOwn(body, "trackingStartDate")) trackingStartDate = body.trackingStartDate || null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/app?habit=sport-1");
  await expect(page.locator("main.shell > .dashboard > footer.site-footer")).toBeAttached();
  await expect(page.locator("body > footer.site-footer")).toHaveCount(0);
  await expect(page.locator("aside .brand-logo")).toHaveAttribute("src", "/icons/favicon-rounded-192.png");
  await page.getByRole("button", { name: "Habit settings" }).click();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await expect(page.getByText("Rhythm", { exact: true })).toBeVisible();
  await expect(page.locator(".primary-choices>button")).toHaveCount(9);
  await expect(page.locator(".primary-choices").getByText("Once per week", { exact: true })).toBeVisible();
  await expect(page.locator(".primary-choices").getByText("Twice per week", { exact: true })).toBeVisible();
  await expect(page.locator(".primary-choices").getByText("Six times per week", { exact: true })).toBeVisible();
  await expect(page.locator(".primary-choices").getByText("7 per week", { exact: true })).toHaveCount(0);
  await expect(page.locator(".weekly-choices")).toHaveCount(0);
  await page.getByLabel("Tracking start date").fill("2026-08-10");
  await page.getByRole("button", { name: "Save date" }).click();
  await expect(page.getByRole("status").locator("strong")).toHaveText("Saved");
  await expect(page.getByRole("status").locator("small")).toHaveText("Start date saved");
  expect(patches.at(-1)).toEqual({ trackingStartDate: "2026-08-10" });
  await expect(page.locator(".start-date-setting").getByText("Saved", { exact: true })).toHaveCount(0);

  await page.getByLabel("Habit label").fill("Training session");
  await page.getByRole("button", { name: "Save label" }).click();
  await expect(page.getByRole("status").locator("strong")).toHaveText("Saved");
  await expect(page.getByRole("status").locator("small")).toHaveText("Label saved");
  expect(patches.at(-1)).toEqual({ label: "Training session" });
  await expect(page.locator(".label-setting").getByText("Saved", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Twice per week/ }).click();
  await expect(page.getByRole("status").locator("small")).toHaveText("Rhythm saved");
  expect(patches.at(-1)).toEqual({ type: "weekly", count: 2, period: "week" });
  await expect(page.getByRole("heading", { name: "Training session" })).toBeVisible();

  await page.getByRole("button", { name: "Habit settings" }).click();
  await page.getByLabel("Habit label").fill("");
  await page.getByRole("button", { name: "Save label" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.getByRole("heading", { name: "Sport" })).toBeVisible();
});
