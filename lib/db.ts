import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";

declare global { var habitDb: Database.Database | undefined; }

export function getDb() {
  if (global.habitDb) return global.habitDb;
  const file = process.env.SQLITE_PATH || "./data/habit.db";
  mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, avatar TEXT,
      access_token TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_sync TEXT
    );
    CREATE TABLE IF NOT EXISTS habits (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL, content TEXT NOT NULL, todoist_recurrence TEXT,
      label_override TEXT,
      override_type TEXT, override_count INTEGER, override_period TEXT,
      track_during_vacations INTEGER NOT NULL DEFAULT 0,
      project_name TEXT, color TEXT DEFAULT '#ff6b57', active INTEGER DEFAULT 1,
      PRIMARY KEY (user_id, task_id)
    );
    CREATE TABLE IF NOT EXISTS completions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL, completed_at TEXT NOT NULL,
      completion_id TEXT NOT NULL, PRIMARY KEY (user_id, completion_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS vacations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_completions_user_date ON completions(user_id, completed_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_vacations_user_dates ON vacations(user_id, start_date, end_date);
  `);
  const habitColumns = db.prepare("PRAGMA table_info(habits)").all() as { name: string }[];
  if (!habitColumns.some((column) => column.name === "label_override")) {
    db.exec("ALTER TABLE habits ADD COLUMN label_override TEXT");
  }
  if (!habitColumns.some((column) => column.name === "track_during_vacations")) {
    db.exec("ALTER TABLE habits ADD COLUMN track_during_vacations INTEGER NOT NULL DEFAULT 0");
  }
  global.habitDb = db;
  return db;
}
