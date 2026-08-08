import assert from "node:assert/strict";
import test from "node:test";
import { buildPeriods, rhythmFor } from "../../lib/habit-periods.ts";

const habit = (overrides = {}) => ({
  task_id: "flight",
  todoist_recurrence: "every day",
  override_type: null,
  override_count: null,
  track_during_vacations: 0,
  tracking_start_date: null,
  ...overrides,
});

const today = new Date(2026, 7, 20, 12);

test("derives safe rhythms from overrides and Todoist recurrence", () => {
  assert.deepEqual(rhythmFor(habit()), { type: "daily", count: 1 });
  assert.deepEqual(rhythmFor(habit({ todoist_recurrence: "every other day" })), { type: "interval", count: 2 });
  assert.deepEqual(rhythmFor(habit({ override_type: "weekly", override_count: 4 })), { type: "weekly", count: 4 });
  assert.deepEqual(rhythmFor(habit({ override_type: "interval", override_count: -2 })), { type: "interval", count: 2 });
});

test("marks completions, open periods, start-date history, and vacations explicitly", () => {
  const periods = buildPeriods(
    habit({ tracking_start_date: "2026-08-18" }),
    [{ task_id: "flight", completed_at: "2026-08-19T12:00:00" }],
    [{ id: 1, title: "Dragon Cove", start_date: "2026-08-18", end_date: "2026-08-18" }],
    1,
    today,
  );
  const byDate = new Map(periods.map((period) => [period.key.slice(0, 10), period]));
  assert.equal(byDate.get("2026-08-17").state, "before_start");
  assert.equal(byDate.get("2026-08-18").state, "vacation");
  assert.equal(byDate.get("2026-08-19").state, "done");
  assert.equal(byDate.get("2026-08-20").state, "future");
});

test("keeps interval boundaries stable across history window sizes", () => {
  const source = habit({ override_type: "interval", override_count: 2 });
  const short = buildPeriods(source, [], [], 12, today);
  const longKeys = new Set(buildPeriods(source, [], [], 24, today).map((period) => period.key));
  assert.ok(short.length > 100);
  assert.ok(short.every((period) => longKeys.has(period.key)));
});

test("counts vacation periods when tracking during vacations is enabled", () => {
  const vacations = [{ id: 1, title: "Dragon Cove", start_date: "2026-08-19", end_date: "2026-08-19" }];
  const paused = buildPeriods(habit(), [], vacations, 1, today).find((period) => period.key.startsWith("2026-08-19"));
  const tracked = buildPeriods(habit({ track_during_vacations: 1 }), [], vacations, 1, today).find((period) =>
    period.key.startsWith("2026-08-19"),
  );
  assert.equal(paused.state, "vacation");
  assert.equal(tracked.state, "miss");
});

test("counts Todoist and manual completions together without collapsing same-day entries", () => {
  const weekly = habit({
    override_type: "weekly",
    override_count: 2,
    tracking_start_date: "2026-08-17",
  });
  const current = buildPeriods(
    weekly,
    [
      { task_id: "flight", completed_at: "2026-08-18T09:00:00Z" },
      { task_id: "flight", completed_at: "2026-08-18T12:00:00" },
    ],
    [],
    1,
    today,
  ).at(-1);

  assert.equal(current.completed, 2);
  assert.equal(current.target, 2);
  assert.equal(current.state, "done");
});
