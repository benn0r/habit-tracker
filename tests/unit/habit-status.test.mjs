import assert from "node:assert/strict";
import test from "node:test";
import { periodTones, trackedStreak } from "../../lib/habit-status.ts";

test("shows the first failed period as a warning and repeated failures as misses", () => {
  assert.deepEqual(
    periodTones(["done", "miss", "miss", "miss"]),
    ["done", "warning", "miss", "miss"],
  );
});

test("a completed period resets the failure sequence", () => {
  assert.deepEqual(
    periodTones(["miss", "miss", "done", "miss"]),
    ["warning", "miss", "done", "warning"],
  );
});

test("an open period does not interrupt an existing failure sequence", () => {
  assert.deepEqual(
    periodTones(["miss", "future", "miss"]),
    ["warning", "future", "miss"],
  );
});

test("vacation periods do not count toward or break a tracked streak", () => {
  assert.equal(trackedStreak(["miss", "before_start", "done", "vacation", "done", "future"]), 2);
});
