export const MAX_HABIT_LABEL_LENGTH = 80;
const SCHEDULE_TYPES = ["todoist", "daily", "interval", "weekly"] as const;

export type HabitSettingsUpdate = {
  labelOverride?: string | null;
  schedule?: { type: typeof SCHEDULE_TYPES[number]; count: number | null; period: string | null };
};

export function normalizeHabitLabel(value: unknown) {
  if (typeof value !== "string") throw new Error("Label must be text");
  const label = value.trim();
  if (label.length > MAX_HABIT_LABEL_LENGTH) {
    throw new Error(`Label must be ${MAX_HABIT_LABEL_LENGTH} characters or fewer`);
  }
  return label || null;
}

export function parseHabitSettings(value: unknown): HabitSettingsUpdate {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid settings");
  const body = value as Record<string, unknown>;
  const update: HabitSettingsUpdate = {};

  if (Object.hasOwn(body, "label")) update.labelOverride = normalizeHabitLabel(body.label);
  if (Object.hasOwn(body, "type")) {
    if (typeof body.type !== "string" || !SCHEDULE_TYPES.includes(body.type as typeof SCHEDULE_TYPES[number])) {
      throw new Error("Invalid schedule");
    }
    const type = body.type as typeof SCHEDULE_TYPES[number];
    const count = typeof body.count === "number" ? body.count : null;
    if (type === "weekly" && (!Number.isInteger(count) || count! < 1 || count! > 7)) {
      throw new Error("Weekly target must be between 1 and 7");
    }
    update.schedule = {
      type,
      count: type === "weekly" || type === "interval" ? count : null,
      period: type === "weekly" ? "week" : type === "interval" ? "days" : null,
    };
  }
  if (!Object.hasOwn(update, "labelOverride") && !update.schedule) throw new Error("No settings supplied");
  return update;
}
