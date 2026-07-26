export type HabitPeriodState = "done" | "miss" | "future" | "vacation" | "before_start";
export type HabitPeriodTone = "done" | "warning" | "miss" | "future" | "vacation";

export function periodTones(states: HabitPeriodState[]): HabitPeriodTone[] {
  let previousWasMiss = false;

  return states.map((state) => {
    if (state === "before_start") return "vacation";
    if (state === "future" || state === "vacation") return state;
    if (state === "done") {
      previousWasMiss = false;
      return "done";
    }

    const tone = previousWasMiss ? "miss" : "warning";
    previousWasMiss = true;
    return tone;
  });
}

export function trackedStreak(states: HabitPeriodState[]) {
  let streak = 0;
  for (let index = states.length - 1; index >= 0; index--) {
    if (states[index] === "future" || states[index] === "vacation" || states[index] === "before_start") continue;
    if (states[index] === "done") streak++;
    else break;
  }
  return streak;
}
