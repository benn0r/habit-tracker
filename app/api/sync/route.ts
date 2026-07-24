import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { initDb, pool } from "@/lib/db";
import { paged } from "@/lib/todoist";

type Task = {
  id: string; content: string; labels: string[]; project_id: string;
  due?: { string?: string; is_recurring?: boolean };
};
type Project = { id: string; name: string };
type Completed = {
  id?: string; task_id?: string; content?: string; completed_at: string;
};

async function runSync(userId: string) {
  await initDb();
  const userResult = await pool.query("SELECT access_token FROM users WHERE id=$1", [userId]);
  if (!userResult.rowCount) throw new Error("User not found");
  const token = userResult.rows[0].access_token;
  const [tasks, projects] = await Promise.all([
    paged<Task>("/tasks", token),
    paged<Project>("/projects", token),
  ]);
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  const habits = tasks.filter((t) => t.labels.some((l) => l.toLowerCase() === "habit"));

  for (const task of habits) {
    await pool.query(
      `INSERT INTO habits(user_id,task_id,content,todoist_recurrence,project_name)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,task_id) DO UPDATE
       SET content=$3,todoist_recurrence=$4,project_name=$5,active=TRUE`,
      [userId, task.id, task.content, task.due?.is_recurring ? task.due.string || "Recurring" : null, projectNames.get(task.project_id) || "Todoist"]
    );
  }
  await pool.query(
    `UPDATE habits SET active=FALSE WHERE user_id=$1 AND NOT(task_id = ANY($2::text[]))`,
    [userId, habits.map((h) => h.id)]
  );

  const since = new Date(); since.setFullYear(since.getFullYear() - 1); since.setDate(since.getDate() - 7);
  const until = new Date(); until.setDate(until.getDate() + 1);
  const completed = await paged<Completed>(
    `/tasks/completed/by_completion_date?since=${encodeURIComponent(since.toISOString())}&until=${encodeURIComponent(until.toISOString())}&limit=200`,
    token
  );
  const known = new Map<string, string>();
  habits.forEach((h) => known.set(h.content.trim().toLowerCase(), h.id));
  for (const item of completed) {
    const taskId = item.task_id || (item.content ? known.get(item.content.trim().toLowerCase()) : undefined);
    if (!taskId || !habits.some((h) => h.id === taskId)) continue;
    await pool.query(
      `INSERT INTO completions(user_id,task_id,completed_at,completion_id) VALUES($1,$2,$3,$4)
       ON CONFLICT(user_id,completion_id) DO NOTHING`,
      [userId, taskId, item.completed_at, item.id || `${taskId}:${item.completed_at}`]
    );
  }
  await pool.query("UPDATE users SET last_sync=NOW() WHERE id=$1", [userId]);
  return { habits: habits.length, completions: completed.length };
}

export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await runSync(userId)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 500 }); }
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await initDb();
  const users = await pool.query("SELECT id FROM users");
  const results = [];
  for (const user of users.rows) results.push(await runSync(user.id));
  return NextResponse.json({ synced: results.length, results });
}
