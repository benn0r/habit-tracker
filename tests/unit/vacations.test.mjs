import assert from "node:assert/strict";
import test from "node:test";
import { parseVacationInput, periodOverlapsVacation } from "../../lib/vacations.ts";

test("validates and normalizes vacation date ranges", () => {
  assert.deepEqual(parseVacationInput({ title: "  Dragon Cove  ", startDate: "2026-08-10", endDate: "2026-08-17" }), {
    title: "Dragon Cove", startDate: "2026-08-10", endDate: "2026-08-17",
  });
  assert.throws(() => parseVacationInput({ title: "Backwards", startDate: "2026-08-17", endDate: "2026-08-10" }), /on or after/);
  assert.throws(() => parseVacationInput({ title: "Impossible", startDate: "2026-02-30", endDate: "2026-03-02" }), /Valid start date/);
});

test("detects any overlap with an inclusive vacation range", () => {
  const vacations = [{ start_date: "2026-08-10", end_date: "2026-08-17" }];
  assert.equal(periodOverlapsVacation(new Date(2026, 7, 9), new Date(2026, 7, 11), vacations), true);
  assert.equal(periodOverlapsVacation(new Date(2026, 7, 18), new Date(2026, 7, 19), vacations), false);
});
