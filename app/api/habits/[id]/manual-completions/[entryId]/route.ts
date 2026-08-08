import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; entryId: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, entryId } = await context.params;
  const result = getDb()
    .prepare("DELETE FROM manual_completions WHERE id=? AND user_id=? AND task_id=?")
    .run(entryId, userId, id);
  if (!result.changes) return NextResponse.json({ error: "Manual entry not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
