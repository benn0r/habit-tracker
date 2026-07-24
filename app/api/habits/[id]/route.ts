import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json();
  const allowed = ["todoist", "daily", "interval", "weekly"];
  if (!allowed.includes(body.type)) return NextResponse.json({ error: "Invalid schedule" }, { status: 400 });
  getDb().prepare(
    `UPDATE habits SET override_type=?,override_count=?,override_period=? WHERE user_id=? AND task_id=?`
  ).run(body.type === "todoist" ? null : body.type, body.count || null, body.period || null, userId, id);
  return NextResponse.json({ ok: true });
}
