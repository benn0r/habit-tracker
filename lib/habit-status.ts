export type HabitPeriodState = "done" | "miss" | "future";
export type HabitPeriodTone = "done" | "warning" | "miss" | "future";

export function periodTones(states: HabitPeriodState[]): HabitPeriodTone[] {
  let previousWasMiss = false;

  return states.map((state) => {
    if (state === "future") return "future";
    if (state === "done") {
      previousWasMiss = false;
      return "done";
    }

    const tone = previousWasMiss ? "miss" : "warning";
    previousWasMiss = true;
    return tone;
  });
}
