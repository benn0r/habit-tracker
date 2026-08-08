import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseManualCompletionInput } from "@/lib/manual-completions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  let entry;
  try {
    entry = parseManualCompletionInput(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid manual entry" },
      { status: 400 },
    );
  }

  const db = getDb();
  const habit = db.prepare("SELECT 1 FROM habits WHERE user_id=? AND task_id=?").get(userId, id);
  if (!habit) return NextResponse.json({ error: "Habit not found" }, { status: 404 });

  const result = db
    .prepare("INSERT INTO manual_completions(user_id,task_id,completed_at) VALUES(?,?,?)")
    .run(userId, id, entry.completedAt);

  return NextResponse.json(
    {
      id: Number(result.lastInsertRowid),
      task_id: id,
      completed_at: entry.completedAt,
      entry_date: entry.date,
    },
    { status: 201 },
  );
}
