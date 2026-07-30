export const MAX_VACATION_TITLE_LENGTH = 80;

export type Vacation = { id: number; title: string; start_date: string; end_date: string };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function localDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function validDateString(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = localDate(value);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getDate() === Number(value.slice(8, 10))
  );
}

export function parseVacationInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid vacation");
  const body = value as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) throw new Error("Title is required");
  if (title.length > MAX_VACATION_TITLE_LENGTH)
    throw new Error(`Title must be ${MAX_VACATION_TITLE_LENGTH} characters or fewer`);
  if (typeof body.startDate !== "string" || !validDateString(body.startDate))
    throw new Error("Valid start date is required");
  if (typeof body.endDate !== "string" || !validDateString(body.endDate)) throw new Error("Valid end date is required");
  const start = localDate(body.startDate);
  const end = localDate(body.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("End date must be on or after the start date");
  }
  return { title, startDate: body.startDate, endDate: body.endDate };
}

export function periodOverlapsVacation(
  periodStart: Date,
  periodEnd: Date,
  vacations: Pick<Vacation, "start_date" | "end_date">[],
) {
  return vacations.some((vacation) => {
    const vacationStart = localDate(vacation.start_date);
    const vacationEndExclusive = localDate(vacation.end_date);
    vacationEndExclusive.setDate(vacationEndExclusive.getDate() + 1);
    return vacationStart < periodEnd && vacationEndExclusive > periodStart;
  });
}
