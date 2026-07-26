import { expect, test } from "@playwright/test";

test("health endpoint reports the running build", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toEqual({ status: "ok", version: "e2etest" });
});
