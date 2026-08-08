import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getDb } from "../../lib/db.ts";
import { parseManualCompletionInput } from "../../lib/manual-completions.ts";

test("validates a manual completion and creates a timezone-safe local timestamp", () => {
  assert.deepEqual(parseManualCompletionInput({ date: "2026-08-07" }), {
    date: "2026-08-07",
    completedAt: "2026-08-07T12:00:00",
  });
  assert.deepEqual(parseManualCompletionInput({ date: "2024-02-29" }), {
    date: "2024-02-29",
    completedAt: "2024-02-29T12:00:00",
  });
});

test("rejects missing, malformed, and impossible manual completion dates", () => {
  assert.throws(() => parseManualCompletionInput(null), /Invalid manual entry/);
  assert.throws(() => parseManualCompletionInput({}), /Valid completion date is required/);
  assert.throws(() => parseManualCompletionInput({ date: "08/07/2026" }), /Valid completion date is required/);
  assert.throws(() => parseManualCompletionInput({ date: "2026-02-29" }), /Valid completion date is required/);
  assert.throws(() => parseManualCompletionInput({ date: "2024-02-30" }), /Valid completion date is required/);
});

test("stores manual completions independently from Todoist sync data", () => {
  const directory = mkdtempSync(join(tmpdir(), "habit-manual-completions-"));
  const previousPath = process.env.SQLITE_PATH;
  process.env.SQLITE_PATH = join(directory, "test.db");
  const db = getDb();

  try {
    db.prepare("INSERT INTO users(id,name,access_token) VALUES(?,?,?)").run("fantasy-user", "Sky Runner", "token");
    db.prepare("INSERT INTO habits(user_id,task_id,content) VALUES(?,?,?)").run(
      "fantasy-user",
      "sport",
      "Dragon training",
    );
    db.prepare("INSERT INTO completions(user_id,task_id,completed_at,completion_id) VALUES(?,?,?,?)").run(
      "fantasy-user",
      "sport",
      "2026-08-06T12:00:00Z",
      "todoist-event",
    );
    db.prepare("INSERT INTO manual_completions(user_id,task_id,completed_at) VALUES(?,?,?)").run(
      "fantasy-user",
      "sport",
      "2026-08-07T12:00:00",
    );

    db.prepare("DELETE FROM completions WHERE user_id=? AND completed_at>=?").run(
      "fantasy-user",
      "2026-08-01T00:00:00Z",
    );

    assert.equal(db.prepare("SELECT count(*) AS count FROM completions").get().count, 0);
    assert.equal(db.prepare("SELECT count(*) AS count FROM manual_completions").get().count, 1);
  } finally {
    db.close();
    globalThis.habitDb = undefined;
    if (previousPath === undefined) delete process.env.SQLITE_PATH;
    else process.env.SQLITE_PATH = previousPath;
    rmSync(directory, { recursive: true, force: true });
  }
});
