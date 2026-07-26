import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseVacationInput } from "@/lib/vacations";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const vacations = db.prepare("SELECT id,title,start_date,end_date FROM vacations WHERE user_id=? ORDER BY start_date DESC").all(userId);
  const habits = db.prepare("SELECT task_id,content,label_override,track_during_vacations FROM habits WHERE user_id=? AND active=1 ORDER BY content").all(userId);
  return NextResponse.json({ vacations, habits });
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let vacation;
  try { vacation = parseVacationInput(await request.json()); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid vacation" }, { status: 400 });
  }
  const result = getDb().prepare("INSERT INTO vacations(user_id,title,start_date,end_date) VALUES(?,?,?,?)")
    .run(userId, vacation.title, vacation.startDate, vacation.endDate);
  return NextResponse.json({ id: Number(result.lastInsertRowid), title: vacation.title, start_date: vacation.startDate, end_date: vacation.endDate }, { status: 201 });
}
