import type { HabitPeriodState } from "./habit-status.ts";
import { localDate, periodOverlapsVacation, type Vacation } from "./vacations.ts";

export type HabitPeriodSource = {
  task_id: string;
  todoist_recurrence: string | null;
  override_type: string | null;
  override_count: number | null;
  track_during_vacations: number;
  tracking_start_date: string | null;
};

export type Completion = { task_id: string; completed_at: string };
export type Rhythm = { type: "daily" | "interval" | "weekly"; count: number };
export type Period = {
  date: Date;
  key: string;
  label: string;
  state: HabitPeriodState;
  completed: number;
  target: number;
};

const keyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function safeInterval(value: number | null, fallback: number) {
  return Number.isInteger(value) && value !== null && value >= 2 && value <= 365 ? value : fallback;
}

export function rhythmFor(habit: HabitPeriodSource): Rhythm {
  if (habit.override_type === "weekly") {
    const count =
      Number.isInteger(habit.override_count) && habit.override_count !== null
        ? Math.min(7, Math.max(1, habit.override_count))
        : 1;
    return { type: "weekly", count };
  }
  if (habit.override_type === "interval") return { type: "interval", count: safeInterval(habit.override_count, 2) };
  if (habit.override_type === "daily") return { type: "daily", count: 1 };
  const text = (habit.todoist_recurrence || "").toLowerCase();
  const parsedInterval = Number(text.match(/every\s+(\d+)\s+days?/)?.[1] || (text.includes("every other day") ? 2 : 0));
  if (parsedInterval > 1) return { type: "interval", count: safeInterval(parsedInterval, 2) };
  if (text.includes("weekly") || text.includes("every week") || /every\s+(mon|tue|wed|thu|fri|sat|sun)/.test(text)) {
    return { type: "weekly", count: 1 };
  }
  return { type: "daily", count: 1 };
}

function subtractMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() - months);
  const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInMonth));
  return result;
}

const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

function alignIntervalStart(start: Date, habit: HabitPeriodSource, periodDays: number) {
  const anchor = habit.tracking_start_date ? localDate(habit.tracking_start_date) : new Date(1970, 0, 1);
  const offset = modulo(calendarDay(start) - calendarDay(anchor), periodDays);
  start.setDate(start.getDate() - offset);
}

export function buildPeriods(
  habit: HabitPeriodSource,
  completions: Completion[],
  vacations: Vacation[],
  months = 12,
  now = new Date(),
): Period[] {
  const today = startOfDay(now);
  const start = subtractMonths(today, months);
  start.setDate(start.getDate() + 1);
  const rhythm = rhythmFor(habit);
  if (rhythm.type === "weekly" || rhythm.type === "daily") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else {
    alignIntervalStart(start, habit, rhythm.count);
  }
  const completionDates = completions
    .filter((completion) => completion.task_id === habit.task_id)
    .map((completion) => startOfDay(new Date(completion.completed_at)));
  const periodDays = rhythm.type === "weekly" ? 7 : rhythm.type === "interval" ? rhythm.count : 1;
  const target = rhythm.type === "weekly" ? rhythm.count : 1;
  const trackingStart = habit.tracking_start_date ? localDate(habit.tracking_start_date) : null;
  const periods: Period[] = [];

  for (
    let periodStart = new Date(start);
    periodStart <= today;
    periodStart.setDate(periodStart.getDate() + periodDays)
  ) {
    const date = new Date(periodStart);
    const end = new Date(date);
    end.setDate(end.getDate() + periodDays);
    const completed = completionDates.filter((completion) => completion >= date && completion < end).length;
    const stillOpen = end > today && completed < target;
    const beforeTrackingStart = trackingStart !== null && end <= trackingStart;
    const onUntrackedVacation =
      !beforeTrackingStart && !habit.track_during_vacations && periodOverlapsVacation(date, end, vacations);
    const state: HabitPeriodState = beforeTrackingStart
      ? "before_start"
      : onUntrackedVacation
        ? "vacation"
        : completed >= target
          ? "done"
          : stillOpen
            ? "future"
            : "miss";
    const lastDay = new Date(end);
    lastDay.setDate(lastDay.getDate() - 1);
    const range =
      periodDays === 1
        ? date.toLocaleDateString(undefined, { dateStyle: "medium" })
        : `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${lastDay.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    periods.push({
      date,
      key: `${keyOf(date)}-${periodDays}`,
      state,
      completed,
      target,
      label: `${range}: ${beforeTrackingStart ? "before tracking started" : onUntrackedVacation ? "vacation · not tracked" : `${completed}/${target} completed`}`,
    });
  }
  return periods;
}
