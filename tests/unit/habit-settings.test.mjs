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

test("rejects interval counts that could stall period generation", () => {
  assert.deepEqual(parseHabitSettings({ type: "interval", count: 2 }), {
    schedule: { type: "interval", count: 2, period: "days" },
  });
  for (const count of [null, 0, 1, -2, 2.5, Number.POSITIVE_INFINITY, 366]) {
    assert.throws(() => parseHabitSettings({ type: "interval", count }), /between 2 and 365 days/);
  }
});

test("parses vacation tracking as an explicit boolean", () => {
  assert.deepEqual(parseHabitSettings({ trackDuringVacations: true }), { trackDuringVacations: true });
  assert.deepEqual(parseHabitSettings({ trackDuringVacations: false }), { trackDuringVacations: false });
  assert.throws(() => parseHabitSettings({ trackDuringVacations: "yes" }), /true or false/);
});

test("parses and clears a tracking start date", () => {
  assert.deepEqual(parseHabitSettings({ trackingStartDate: "2026-08-10" }), { trackingStartDate: "2026-08-10" });
  assert.deepEqual(parseHabitSettings({ trackingStartDate: "" }), { trackingStartDate: null });
  assert.throws(() => parseHabitSettings({ trackingStartDate: "2026-02-30" }), /valid date/);
});
