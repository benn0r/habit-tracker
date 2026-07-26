import { expect, test } from "@playwright/test";

test("warns on the first missed period and turns red on the second consecutive miss", async ({ context, page }) => {
  await context.addCookies([{
    name: "ritual_e2e", value: "1", url: "http://127.0.0.1:3100",
    httpOnly: true, sameSite: "Lax",
  }]);

  const completedAt = new Date();
  completedAt.setDate(completedAt.getDate() - 3);
  completedAt.setHours(12, 0, 0, 0);

  await page.route("**/api/dashboard", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      user: { name: "Fantasy Athlete", email: "athlete@example.test" },
      habits: [{
        task_id: "daily-1", content: "Dragon training", label_override: null,
        todoist_recurrence: "every day", override_type: null, override_count: null,
        override_period: null, project_name: "Mountain Keep", color: "#ff6b57",
      }],
      completions: [{ task_id: "daily-1", completed_at: completedAt.toISOString() }],
    }),
  }));

  await page.goto("/app?habit=daily-1");

  const recentPeriods = await page.locator(".year-grid i").evaluateAll((periods) =>
    periods.slice(-4).map((period) => period.className),
  );
  expect(recentPeriods).toEqual(["done", "warning", "miss", "future"]);
  await expect(page.locator(".chart-legend")).toContainText("First miss");
  await expect(page.locator(".chart-legend")).toContainText("Repeated miss");
});
