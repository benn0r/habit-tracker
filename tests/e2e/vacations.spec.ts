import { expect, test } from "@playwright/test";

const cookie = {
  name: "ritual_e2e", value: "1", url: "http://127.0.0.1:3100",
  httpOnly: true, sameSite: "Lax" as const,
};

const dateKey = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

test("adds vacations and configures which habits keep tracking", async ({ context, page }) => {
  await context.addCookies([cookie]);
  let vacations = [{ id: 1, title: "Winterfell retreat", start_date: "2026-12-20", end_date: "2026-12-27" }];
  let tracksVacation = 0;
  await page.route("**/api/vacations", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { title: string; startDate: string; endDate: string };
      vacations = [...vacations, { id: 2, title: body.title, start_date: body.startDate, end_date: body.endDate }];
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(vacations[1]) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      vacations,
      habits: [{ task_id: "flight", content: "Morning flight", label_override: null, track_during_vacations: tracksVacation }],
    }) });
  });
  await page.route("**/api/vacations/*", (route) => {
    const id = Number(route.request().url().split("/").pop());
    vacations = vacations.filter((vacation) => vacation.id !== id);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/habits/flight", async (route) => {
    const body = route.request().postDataJSON() as { trackDuringVacations: boolean };
    tracksVacation = body.trackDuringVacations ? 1 : 0;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/app/vacations");
  await expect(page.getByRole("heading", { name: "Vacations" })).toBeVisible();
  await expect(page.getByLabel("Track Morning flight during vacations")).not.toBeChecked();

  await page.getByLabel("Vacation title").fill("Summer at Dragon Cove");
  await page.getByLabel("Vacation start date").fill("2026-08-10");
  await page.getByLabel("Vacation end date").fill("2026-08-17");
  await page.getByRole("button", { name: "Add vacation" }).click();
  await expect(page.getByText("Summer at Dragon Cove", { exact: true })).toBeVisible();

  await page.locator(".vacation-habit-list>label").filter({ hasText: "Morning flight" }).click();
  await expect(page.getByText("Tracked during vacations", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete Summer at Dragon Cove" }).click();
  await expect(page.getByText("Summer at Dragon Cove", { exact: true })).not.toBeVisible();
});

test("shows untracked vacation periods in grey and excludes them from consistency", async ({ context, page }) => {
  await context.addCookies([cookie]);
  const completedAt = new Date();
  completedAt.setDate(completedAt.getDate() - 3);
  completedAt.setHours(12, 0, 0, 0);
  await page.route("**/api/dashboard", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      user: { name: "Fantasy Athlete", email: "athlete@example.test" },
      habits: [{
        task_id: "flight", content: "Morning flight", label_override: null,
        todoist_recurrence: "every day", override_type: null, override_count: null,
        override_period: null, track_during_vacations: 0, project_name: "Sky Academy", color: "#4f8ac9",
      }],
      completions: [{ task_id: "flight", completed_at: completedAt.toISOString() }],
      vacations: [
        { id: 1, title: "Long voyage", start_date: dateKey(730), end_date: dateKey(4) },
        { id: 2, title: "Dragon Cove", start_date: dateKey(2), end_date: dateKey(2) },
      ],
    }),
  }));

  await page.goto("/app?habit=flight");

  const recentPeriods = await page.locator(".year-grid i").evaluateAll((periods) => periods.slice(-4).map((period) => period.className));
  expect(recentPeriods).toEqual(["done", "vacation", "warning", "future"]);
  await expect(page.locator(".stats article").filter({ hasText: "CONSISTENCY" }).locator("strong")).toContainText("50%");
  await expect(page.locator(".stats article").filter({ hasText: "MISSED" }).locator("strong")).toHaveText("1");
  await expect(page.locator(".chart-legend")).toContainText("Vacation");
});
