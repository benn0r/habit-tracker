import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseHabitSettings } from "@/lib/habit-settings";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  let update;
  try { update = parseHabitSettings(await request.json()); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid settings" }, { status: 400 });
  }
  const db = getDb();
  if (Object.hasOwn(update, "labelOverride")) {
    db.prepare("UPDATE habits SET label_override=? WHERE user_id=? AND task_id=?")
      .run(update.labelOverride, userId, id);
  }
  if (update.schedule) {
    const { type, count, period } = update.schedule;
    db.prepare(
      `UPDATE habits SET override_type=?,override_count=?,override_period=? WHERE user_id=? AND task_id=?`
    ).run(type === "todoist" ? null : type, count, period, userId, id);
  }
  return NextResponse.json({ ok: true });
}
