const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDateString(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function parseManualCompletionInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid manual entry");
  const body = value as Record<string, unknown>;
  if (typeof body.date !== "string" || !validDateString(body.date)) {
    throw new Error("Valid completion date is required");
  }

  return {
    date: body.date,
    // A timezone-free noon preserves the chosen calendar date when browsers
    // turn this value into a local Date for status calculations.
    completedAt: `${body.date}T12:00:00`,
  };
}
