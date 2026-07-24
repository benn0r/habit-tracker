import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json();
  const allowed = ["todoist", "daily", "interval", "weekly"];
  if (!allowed.includes(body.type)) return NextResponse.json({ error: "Invalid schedule" }, { status: 400 });
  await initDb();
  await pool.query(
    `UPDATE habits SET override_type=$1,override_count=$2,override_period=$3 WHERE user_id=$4 AND task_id=$5`,
    [body.type === "todoist" ? null : body.type, body.count || null, body.period || null, userId, id]
  );
  return NextResponse.json({ ok: true });
}
