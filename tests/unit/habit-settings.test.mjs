import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHabitLabel, parseHabitSettings } from "../../lib/habit-settings.ts";

test("normalizes a custom habit label", () => {
  assert.equal(normalizeHabitLabel("  Morning movement  "), "Morning movement");
  assert.equal(normalizeHabitLabel("   "), null);
});

test("rejects invalid habit labels", () => {
  assert.throws(() => normalizeHabitLabel(42), /Label must be text/);
  assert.throws(() => normalizeHabitLabel("x".repeat(81)), /80 characters or fewer/);
});

test("parses label-only settings without changing rhythm", () => {
  assert.deepEqual(parseHabitSettings({ label: "  Training  " }), { labelOverride: "Training" });
});

test("validates weekly rhythm settings", () => {
  assert.deepEqual(parseHabitSettings({ type: "weekly", count: 3 }), {
    schedule: { type: "weekly", count: 3, period: "week" },
  });
  assert.throws(() => parseHabitSettings({ type: "weekly", count: 8 }), /between 1 and 7/);
  assert.throws(() => parseHabitSettings({}), /No settings supplied/);
});
