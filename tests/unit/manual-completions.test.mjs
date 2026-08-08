import assert from "node:assert/strict";
import test from "node:test";
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
