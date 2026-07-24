import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await initDb();
  const [user, habits, completions] = await Promise.all([
    pool.query("SELECT name,email,avatar,last_sync FROM users WHERE id=$1", [userId]),
    pool.query("SELECT * FROM habits WHERE user_id=$1 AND active=TRUE ORDER BY content", [userId]),
    pool.query("SELECT task_id,completed_at FROM completions WHERE user_id=$1 AND completed_at > NOW() - INTERVAL '13 months' ORDER BY completed_at", [userId]),
  ]);
  return NextResponse.json({ user: user.rows[0], habits: habits.rows, completions: completions.rows });
}
