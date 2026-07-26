import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const result = getDb().prepare("DELETE FROM vacations WHERE id=? AND user_id=?").run(id, userId);
  if (!result.changes) return NextResponse.json({ error: "Vacation not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
