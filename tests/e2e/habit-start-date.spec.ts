import { expect, test } from "@playwright/test";
import { authenticate, dateKey, freezeTime, localNoon } from "./support";

test("greys periods before the habit start date and excludes them from analytics", async ({ context, page }) => {
  await authenticate(context);
  await freezeTime(page);
  const completedAt = localNoon(1);
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: "Fantasy Athlete", email: "athlete@example.test" },
        habits: [
          {
            task_id: "flight",
            content: "Morning flight",
            label_override: null,
            todoist_recurrence: "every day",
            override_type: null,
            override_count: null,
            override_period: null,
            track_during_vacations: 0,
            tracking_start_date: dateKey(1),
            project_name: "Inbox",
            color: "#4f8ac9",
          },
        ],
        completions: [{ task_id: "flight", completed_at: completedAt.toISOString() }],
        vacations: [],
      }),
    }),
  );

  await page.goto("/app?habit=flight");

  await expect(page.locator(".dashboard>header p")).toHaveText("every day");
  await expect(page.getByText("Inbox", { exact: true })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Read-only Todoist access");
  const beforeStartPeriods = page.locator('.year-grid i[data-period-state="before_start"]');
  await expect(beforeStartPeriods).not.toHaveCount(0);
  await expect(page.locator(".stats article").filter({ hasText: "CONSISTENCY" }).locator("strong")).toContainText(
    "100%",
  );
  await expect(page.locator(".stats article").filter({ hasText: "MISSED" }).locator("strong")).toHaveText("0");
  await expect(page.locator(".chart-legend")).toContainText("Untracked");
  await expect(page.locator(".chart-legend")).not.toContainText("Before start");
  await beforeStartPeriods.first().hover();
  await expect(page.getByRole("tooltip").locator("strong")).not.toBeEmpty();
  await expect(page.getByRole("tooltip").locator("small")).toHaveText("before tracking started");

  await page.goto("/app?habit=all");
  const summary = page.locator(".habit-summary-grid>button").filter({ hasText: "Morning flight" });
  await expect(summary.locator(".summary-metrics").filter({ hasText: "Previous period" })).toContainText(
    "Not trackedBefore tracking started",
  );
  await expect(summary).not.toContainText("Syncing older history");
  await expect(summary.locator(".summary-trend")).toHaveCount(0);
  await expect(summary).not.toContainText("Inbox");
  await summary.locator(".summary-recent i").first().hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
});
