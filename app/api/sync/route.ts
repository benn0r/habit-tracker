import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paged } from "@/lib/todoist";

type Task = {
  id: string; content: string; labels: string[]; project_id: string;
  due?: { string?: string; is_recurring?: boolean };
};
type Project = { id: string; name: string };
type Completed = {
  id?: string; task_id?: string; content?: string; completed_at: string;
};

async function completedForYear(token: string, since: Date, until: Date) {
  const all: Completed[] = [];
  let windowStart = new Date(since);
  while (windowStart < until) {
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 89);
    if (windowEnd > until) windowEnd.setTime(until.getTime());
    all.push(...await paged<Completed>(
      `/tasks/completed/by_completion_date?since=${encodeURIComponent(windowStart.toISOString())}&until=${encodeURIComponent(windowEnd.toISOString())}&limit=200`,
      token,
      "items"
    ));
    windowStart = windowEnd;
  }
  return all;
}

async function runSync(userId: string) {
  const db = getDb();
  const user = db.prepare("SELECT access_token FROM users WHERE id=?").get(userId) as { access_token: string } | undefined;
  if (!user) throw new Error("User not found");
  const token = user.access_token;
  const [tasks, projects] = await Promise.all([
    paged<Task>("/tasks", token),
    paged<Project>("/projects", token),
  ]);
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  const habits = tasks.filter((t) => t.labels.some((l) => l.toLowerCase() === "habit"));

  const upsertHabit = db.prepare(
      `INSERT INTO habits(user_id,task_id,content,todoist_recurrence,project_name)
       VALUES(?,?,?,?,?) ON CONFLICT(user_id,task_id) DO UPDATE SET
       content=excluded.content,todoist_recurrence=excluded.todoist_recurrence,
       project_name=excluded.project_name,active=1`
  );
  const saveHabits = db.transaction((items: Task[]) => {
    db.prepare("UPDATE habits SET active=0 WHERE user_id=?").run(userId);
    for (const task of items) upsertHabit.run(
      userId, task.id, task.content,
      task.due?.is_recurring ? task.due.string || "Recurring" : null,
      projectNames.get(task.project_id) || "Todoist"
    );
  });
  saveHabits(habits);

  const since = new Date(); since.setFullYear(since.getFullYear() - 1); since.setDate(since.getDate() - 7);
  const until = new Date(); until.setDate(until.getDate() + 1);
  const completed = await completedForYear(token, since, until);
  const known = new Map<string, string>();
  habits.forEach((h) => known.set(h.content.trim().toLowerCase(), h.id));
  const insertCompletion = db.prepare(
    `INSERT INTO completions(user_id,task_id,completed_at,completion_id) VALUES(?,?,?,?)
     ON CONFLICT(user_id,completion_id) DO NOTHING`
  );
  const saveCompletions = db.transaction((items: Completed[]) => {
    db.prepare("DELETE FROM completions WHERE user_id=? AND completed_at>=?").run(userId, since.toISOString());
    for (const item of items) {
      const taskId = item.task_id
        || (item.id && habits.some((h) => h.id === item.id) ? item.id : undefined)
        || (item.content ? known.get(item.content.trim().toLowerCase()) : undefined);
      if (!taskId || !habits.some((h) => h.id === taskId)) continue;
      insertCompletion.run(userId, taskId, item.completed_at, `${taskId}:${item.completed_at}`);
    }
  });
  saveCompletions(completed);
  db.prepare("UPDATE users SET last_sync=? WHERE id=?").run(new Date().toISOString(), userId);
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
  const users = getDb().prepare("SELECT id FROM users").all() as { id: string }[];
  const results = [];
  for (const user of users) results.push(await runSync(user.id));
  return NextResponse.json({ synced: results.length, results });
}
