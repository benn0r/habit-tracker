import { expect, test } from "@playwright/test";

const dateKey = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

test("greys periods before the habit start date and excludes them from analytics", async ({ context, page }) => {
  await context.addCookies([{
    name: "ritual_e2e", value: "1", url: "http://127.0.0.1:3100",
    httpOnly: true, sameSite: "Lax",
  }]);
  const completedAt = new Date();
  completedAt.setDate(completedAt.getDate() - 1);
  completedAt.setHours(12, 0, 0, 0);
  await page.route("**/api/dashboard", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      user: { name: "Fantasy Athlete", email: "athlete@example.test" },
      habits: [{
        task_id: "flight", content: "Morning flight", label_override: null,
        todoist_recurrence: "every day", override_type: null, override_count: null,
        override_period: null, track_during_vacations: 0, tracking_start_date: dateKey(1),
        project_name: "Sky Academy", color: "#4f8ac9",
      }],
      completions: [{ task_id: "flight", completed_at: completedAt.toISOString() }],
      vacations: [],
    }),
  }));

  await page.goto("/app?habit=flight");

  await expect(page.locator(".year-grid i.before-start")).not.toHaveCount(0);
  await expect(page.locator(".stats article").filter({ hasText: "CONSISTENCY" }).locator("strong")).toContainText("100%");
  await expect(page.locator(".stats article").filter({ hasText: "MISSED" }).locator("strong")).toHaveText("0");
  await expect(page.locator(".chart-legend")).toContainText("Before start");
  await page.locator(".year-grid i.before-start").first().hover();
  await expect(page.getByRole("tooltip").locator("strong")).not.toBeEmpty();
  await expect(page.getByRole("tooltip").locator("small")).toHaveText("before tracking started");

  await page.goto("/app?habit=all");
  const summary = page.locator(".habit-summary-grid>button").filter({ hasText: "Morning flight" });
  await expect(summary.locator(".summary-metrics").filter({ hasText: "Previous period" })).toContainText("Not trackedBefore tracking started");
  await expect(summary).not.toContainText("Syncing older history");
  await summary.locator(".summary-recent i").first().hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
});
