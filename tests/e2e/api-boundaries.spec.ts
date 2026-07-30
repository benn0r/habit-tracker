import { expect, test } from "@playwright/test";
import { authenticate } from "./support";

test("protected API routes reject anonymous requests", async ({ request }) => {
  const responses = await Promise.all([
    request.get("/api/dashboard"),
    request.get("/api/vacations"),
    request.post("/api/vacations", { data: {} }),
    request.patch("/api/habits/flight", { data: {} }),
    request.delete("/api/vacations/1"),
    request.post("/api/sync"),
    request.get("/api/sync"),
  ]);

  for (const response of responses) {
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  }
});

test("OAuth login uses read-only scope and a protected state cookie", async ({ request }) => {
  const response = await request.get("/api/auth/login", { maxRedirects: 0 });
  expect(response.status()).toBe(307);

  const location = new URL(response.headers().location);
  expect(location.origin).toBe("https://todoist.com");
  expect(location.pathname).toBe("/oauth/authorize");
  expect(location.searchParams.get("scope")).toBe("data:read");
  expect(location.searchParams.get("state")).toMatch(/^[a-f0-9]{48}$/);

  const cookie = response.headers()["set-cookie"];
  expect(cookie).toContain("todoist_state=");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=lax");
});

test("authenticated APIs reject invalid vacation and rhythm payloads", async ({ context }) => {
  await authenticate(context);

  const vacation = await context.request.post("/api/vacations", {
    data: { title: "Impossible trip", startDate: "2026-02-30", endDate: "2026-03-02" },
  });
  expect(vacation.status()).toBe(400);
  expect(await vacation.json()).toEqual({ error: "Valid start date is required" });

  const interval = await context.request.patch("/api/habits/flight", {
    data: { type: "interval", count: -2 },
  });
  expect(interval.status()).toBe(400);
  expect(await interval.json()).toEqual({ error: "Interval must be between 2 and 365 days" });

  const missingHabit = await context.request.patch("/api/habits/not-found", { data: { label: "Training" } });
  expect(missingHabit.status()).toBe(404);
  expect(await missingHabit.json()).toEqual({ error: "Habit not found" });
});
