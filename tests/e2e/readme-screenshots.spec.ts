import path from "node:path";
import { expect, test } from "@playwright/test";
import { authenticate, freezeTime, TEST_NOW } from "./support";

test.skip(process.env.UPDATE_README_SCREENSHOTS !== "1", "Run explicitly to refresh README screenshots");

const habits = [
  ["flight", "Morning flight training", "every day", "Sky Academy"],
  ["spellbook", "Read the spellbook", "every day", "Wizard Studies"],
  ["dragon", "Care for the dragon", "every week", "Dragon Keep"],
  ["potions", "Prepare potions", "every 2 days", "Alchemy Lab"],
  ["forest", "Walk the enchanted forest", "every week", "Wellbeing"],
  ["stars", "Journal the constellations", "every day", "Observatory"],
].map(([task_id, content, todoist_recurrence, project_name], index) => ({
  task_id,
  content,
  todoist_recurrence,
  project_name,
  label_override: null,
  override_type: null,
  override_count: null,
  override_period: null,
  color: ["#4f8ac9", "#8d6cc4", "#e05c45", "#d39c3f", "#4e8b67", "#566b9f"][index],
}));

function fantasyCompletions() {
  const completions: { task_id: string; completed_at: string }[] = [];
  for (let daysAgo = 1; daysAgo <= 400; daysAgo++) {
    const date = new Date(TEST_NOW);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(12, 0, 0, 0);
    const completed_at = date.toISOString();
    if (daysAgo % 7 !== 0 && daysAgo % 13 !== 0) completions.push({ task_id: "flight", completed_at });
    if (daysAgo % 4 !== 0) completions.push({ task_id: "spellbook", completed_at });
    if ([1, 2, 4, 6].includes(date.getDay()) && daysAgo % 19 !== 0)
      completions.push({ task_id: "dragon", completed_at });
    if (daysAgo % 2 === 0 && daysAgo % 10 !== 0) completions.push({ task_id: "potions", completed_at });
    if ([0, 3, 6].includes(date.getDay()) && daysAgo % 17 !== 0) completions.push({ task_id: "forest", completed_at });
    if (daysAgo % 5 !== 0 && daysAgo % 11 !== 0) completions.push({ task_id: "stars", completed_at });
  }
  return completions;
}

test("captures the fantasy-data app dashboard for the README", async ({ context, page }, testInfo) => {
  await authenticate(context);
  await freezeTime(page);
  await page.route("**/api/dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { name: "Lyra Moonwhisper", email: "lyra@moonkeep.example", last_sync: TEST_NOW.toISOString() },
        habits,
        completions: fantasyCompletions(),
      }),
    }),
  );

  const mobile = testInfo.project.name === "mobile-chromium";
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.goto("/app?range=90d");
  await expect(page.getByRole("heading", { name: "Your dashboard" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });

  await page.screenshot({
    path: path.resolve(`docs/screenshots/habit-tracker-${mobile ? "mobile" : "desktop"}.jpg`),
    type: "jpeg",
    quality: 88,
    fullPage: false,
  });
});
