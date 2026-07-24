import { Pool } from "pg";

declare global { var habitPool: Pool | undefined; }

const pool = global.habitPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});
if (process.env.NODE_ENV !== "production") global.habitPool = pool;

let ready: Promise<void> | undefined;
export function initDb() {
  ready ??= pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, avatar TEXT,
      access_token TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), last_sync TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS habits (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL, content TEXT NOT NULL, todoist_recurrence TEXT,
      override_type TEXT, override_count INTEGER, override_period TEXT,
      project_name TEXT, color TEXT DEFAULT '#ff6b57', active BOOLEAN DEFAULT TRUE,
      PRIMARY KEY (user_id, task_id)
    );
    CREATE TABLE IF NOT EXISTS completions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL, completed_at TIMESTAMPTZ NOT NULL,
      completion_id TEXT NOT NULL, PRIMARY KEY (user_id, completion_id)
    );
  `).then(() => undefined);
  return ready;
}

export { pool };
