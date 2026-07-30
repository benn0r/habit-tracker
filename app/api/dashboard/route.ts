import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.E2E_TEST_MODE === "1" && userId === "e2e-user") {
    return NextResponse.json({
      user: { name: "Fantasy Athlete", email: "athlete@example.test" },
      habits: [
        {
          task_id: "e2e-habit",
          content: "Sport",
          label_override: null,
          todoist_recurrence: "every week",
          override_type: null,
          override_count: null,
          override_period: null,
          track_during_vacations: 0,
          project_name: "Training",
          color: "#ff6b57",
        },
      ],
      completions: [],
      vacations: [],
    });
  }
  const db = getDb();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 25);
  const user = db.prepare("SELECT name,email,avatar,last_sync FROM users WHERE id=?").get(userId);
  const habits = db.prepare("SELECT * FROM habits WHERE user_id=? AND active=1 ORDER BY content").all(userId);
  const completions = db
    .prepare("SELECT task_id,completed_at FROM completions WHERE user_id=? AND completed_at > ? ORDER BY completed_at")
    .all(userId, cutoff.toISOString());
  const vacations = db
    .prepare("SELECT id,title,start_date,end_date FROM vacations WHERE user_id=? ORDER BY start_date")
    .all(userId);
  return NextResponse.json({ user, habits, completions, vacations });
}
