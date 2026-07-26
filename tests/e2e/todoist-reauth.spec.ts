import { createHash, randomBytes } from "crypto";
import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";

const databasePath = process.env.SQLITE_PATH || "/tmp/habit-tracker-e2e.db";

test("expired Todoist authorization redirects sync through OAuth", async ({ context, page }) => {
  // Initialize the application database before adding an authenticated fixture.
  await page.goto("/");

  const userId = `e2e-reauth-${randomBytes(8).toString("hex")}`;
  const session = randomBytes(32).toString("base64url");
  const sessionHash = createHash("sha256").update(session).digest("hex");
  const database = new Database(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, avatar TEXT,
      access_token TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_sync TEXT
    );
    CREATE TABLE IF NOT EXISTS habits (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL, content TEXT NOT NULL, todoist_recurrence TEXT,
      override_type TEXT, override_count INTEGER, override_period TEXT,
      project_name TEXT, color TEXT DEFAULT '#ff6b57', active INTEGER DEFAULT 1,
      PRIMARY KEY (user_id, task_id)
    );
    CREATE TABLE IF NOT EXISTS completions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL, completed_at TEXT NOT NULL,
      completion_id TEXT NOT NULL, PRIMARY KEY (user_id, completion_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  database.prepare(
    "INSERT INTO users(id,name,email,access_token) VALUES(?,?,?,?)"
  ).run(userId, "Fantasy Athlete", "athlete@example.test", "expired-token");
  database.prepare(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)"
  ).run(sessionHash, userId, new Date(Date.now() + 60_000).toISOString());
  database.close();

  await context.addCookies([{
    name: "ritual_session",
    value: session,
    url: "http://127.0.0.1:3100",
    httpOnly: true,
    sameSite: "Lax",
  }]);
  await page.route("**/api/sync", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({
      error: "Todoist authorization expired",
      code: "TODOIST_REAUTH_REQUIRED",
    }),
  }));
  await page.route("**/api/auth/login", (route) => route.fulfill({
    status: 200,
    contentType: "text/plain",
    body: "OAuth login reached",
  }));

  await page.goto("/app");
  const syncButton = page.locator("aside button.sync");
  if (!await syncButton.isVisible()) {
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  }
  await expect(syncButton).toBeVisible();
  await syncButton.click();

  await expect(page).toHaveURL("/api/auth/login");
  await expect(page.getByText("OAuth login reached")).toBeVisible();
});
