import type { BrowserContext, Page } from "@playwright/test";

export const APP_ORIGIN = "http://127.0.0.1:3100";
export const TEST_NOW = new Date(2026, 6, 27, 12);

export async function authenticate(context: BrowserContext) {
  await context.addCookies([
    {
      name: "ritual_e2e",
      value: "1",
      url: APP_ORIGIN,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export function dateKey(daysAgo: number) {
  const date = new Date(TEST_NOW);
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function localNoon(daysAgo: number) {
  const date = new Date(TEST_NOW);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0);
  return date;
}

export async function freezeTime(page: Page) {
  await page.clock.setFixedTime(TEST_NOW);
}
