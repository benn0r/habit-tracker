import { expect, test } from "@playwright/test";
import { authenticate, freezeTime, localNoon } from "./support";

test("warns on the first missed period and turns red on the second consecutive miss", async ({ context, page }) => {
  await authenticate(context);
  await freezeTime(page);
  const completedAt = localNoon(3);

  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: "Fantasy Athlete", email: "athlete@example.test" },
        habits: [
          {
            task_id: "daily-1",
            content: "Dragon training",
            label_override: null,
            todoist_recurrence: "every day",
            override_type: null,
            override_count: null,
            override_period: null,
            project_name: "Mountain Keep",
            color: "#ff6b57",
          },
        ],
        completions: [{ task_id: "daily-1", completed_at: completedAt.toISOString() }],
      }),
    }),
  );

  await page.goto("/app?habit=daily-1");

  const recentPeriods = await page.locator(".year-grid i").evaluateAll((periods) =>
    periods.slice(-4).map((period) => ({
      state: period.getAttribute("data-period-state"),
      tone: period.getAttribute("data-period-tone"),
    })),
  );
  expect(recentPeriods).toEqual([
    { state: "done", tone: "done" },
    { state: "miss", tone: "warning" },
    { state: "miss", tone: "miss" },
    { state: "future", tone: "future" },
  ]);
  await expect(page.locator(".chart-legend")).toContainText("First miss");
  await expect(page.locator(".chart-legend")).toContainText("Repeated miss");
});
