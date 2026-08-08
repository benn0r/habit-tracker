import { expect, test } from "@playwright/test";
import { authenticate, dateKey, freezeTime, localNoon } from "./support";

test("adds and deletes manual completions and recalculates habit status", async ({ context, page }) => {
  await authenticate(context);
  await freezeTime(page);

  type ManualCompletion = {
    id: number;
    task_id: string;
    completed_at: string;
    entry_date: string;
  };
  let manualCompletions: ManualCompletion[] = [];

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
            label_override: null,
            todoist_recurrence: "every day",
            override_type: null,
            override_count: null,
            override_period: null,
            track_during_vacations: 0,
            tracking_start_date: dateKey(2),
            project_name: "Training Grounds",
            color: "#ff6b57",
          },
        ],
        completions: [{ task_id: "sport-1", completed_at: localNoon(2).toISOString() }],
        manual_completions: manualCompletions,
        vacations: [],
      }),
    }),
  );
  await page.route("**/api/habits/sport-1/manual-completions/*", async (route) => {
    expect(route.request().method()).toBe("DELETE");
    const entryId = Number(route.request().url().split("/").pop());
    manualCompletions = manualCompletions.filter((entry) => entry.id !== entryId);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/habits/sport-1/manual-completions", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ date: dateKey(1) });
    const entry: ManualCompletion = {
      id: 7,
      task_id: "sport-1",
      completed_at: localNoon(1).toISOString(),
      entry_date: dateKey(1),
    };
    manualCompletions = [...manualCompletions, entry];
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(entry) });
  });

  await page.goto("/app?habit=sport-1");

  const consistency = page.locator(".stats article").filter({ hasText: "CONSISTENCY" }).locator("strong");
  const successful = page.locator(".stats article").filter({ hasText: "SUCCESSFUL PERIODS" }).locator("strong");
  const missed = page.locator(".stats article").filter({ hasText: "MISSED" }).locator("strong");
  const entries = page.locator(".manual-entry-list");

  await expect(page.getByRole("heading", { name: "Add a missed check-in" })).toBeVisible();
  await expect(page.getByLabel("Completion date")).toHaveAttribute("type", "date");
  await expect(entries).toContainText("No manual entries for this habit yet.");
  await expect(consistency).toContainText("50%");
  await expect(successful).toHaveText("1");
  await expect(missed).toHaveText("1");

  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.locator(".manual-entry-card").getByRole("alert")).toHaveText(
    "Choose the date you completed this habit.",
  );

  await page.getByLabel("Completion date").fill(dateKey(1));
  await page.getByRole("button", { name: "Add entry" }).click();

  await expect(page.getByRole("status").locator("small")).toHaveText("Manual entry added");
  await expect(entries.getByText("Added manually", { exact: true })).toBeVisible();
  await expect(consistency).toContainText("100%");
  await expect(successful).toHaveText("2");
  await expect(missed).toHaveText("0");
  await expect(page.locator('.year-grid i[data-period-state="done"]')).toHaveCount(2);

  await page.goto("/app?habit=all");
  const summary = page.locator(".habit-summary-grid > button").filter({ hasText: "Sport" });
  await expect(summary.locator(".summary-head > b")).toHaveText("100%");
  await page.goto("/app?habit=sport-1");
  await expect(entries.getByText("Added manually", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Delete manual entry from/ }).click();

  await expect(page.getByRole("status").locator("small")).toHaveText("Manual entry deleted");
  await expect(entries).toContainText("No manual entries for this habit yet.");
  await expect(consistency).toContainText("50%");
  await expect(successful).toHaveText("1");
  await expect(missed).toHaveText("1");
  await expect(page.locator('.year-grid i[data-period-state="done"]')).toHaveCount(1);
});
